import { asc, eq, inArray } from "drizzle-orm";

import { calculateEmploymentProjection } from "~/domain/employment";
import { projectedManualAmount, type EstimateSettingsInput, type EstimateWarning, type ScenarioInput } from "~/domain/tax-estimate";
import { calculateHouseholdEstimate, type PersonEstimateInput } from "~/domain/tax-calculator";
import { rules2026Manitoba } from "~/domain/tax-rules/2026-manitoba";
import { type TaxTreatment } from "~/domain/tax-item";
import { employments, paycheques, people, records, taxEstimatePersonInputs, taxEstimateSettings, taxItems } from "~/server/db/schema";
import type { Database } from "./helpers";
import { requireActiveYear, requireHousehold } from "./helpers";

type ScenarioPerson = ScenarioInput["people"][number];

function emptyPerson(id: number, name: string): PersonEstimateInput {
  return {
    id, name, employmentIncomeCents: 0, interestIncomeCents: 0,
    rrspDeductionCents: 0, fhsaDeductionCents: 0, professionalDuesCents: 0,
    incomeTaxWithheldCents: 0, cppCents: 0, cpp2Cents: 0, eiCents: 0,
    currentTuitionCents: 0, federalTuitionCarryforwardCents: 0,
    manitobaTuitionCarryforwardCents: 0, fullTimeStudyMonths: 0, partTimeStudyMonths: 0,
  };
}

const treatmentField: Partial<Record<TaxTreatment, keyof PersonEstimateInput>> = {
  interest_income: "interestIncomeCents",
  rrsp_deduction: "rrspDeductionCents",
  fhsa_deduction: "fhsaDeductionCents",
  professional_dues: "professionalDuesCents",
  current_tuition: "currentTuitionCents",
  federal_tuition_carryforward: "federalTuitionCarryforwardCents",
  manitoba_tuition_carryforward: "manitobaTuitionCarryforwardCents",
};

function addPersonAmount(person: PersonEstimateInput, treatment: TaxTreatment, amount: number) {
  const field = treatmentField[treatment];
  if (!field) return;
  (person[field] as number) += amount;
}

function projectedDeduction(total: number, scenario: ScenarioPerson | undefined, kind: "rrsp" | "fhsa") {
  return total + (kind === "rrsp" ? scenario?.rrspDeductionCents ?? 0 : scenario?.fhsaDeductionCents ?? 0);
}

export async function buildTaxEstimate(db: Database, scenario?: ScenarioInput, requestedTaxYearId?: number) {
  const household = await requireHousehold(db);
  const activeYear = await requireActiveYear(db, household.id);
  const requestedYear = requestedTaxYearId
    ? await db.query.taxYears.findFirst({ where: (table, operators) => operators.and(operators.eq(table.id, requestedTaxYearId), operators.eq(table.householdId, household.id)) })
    : null;
  const year = requestedYear ?? activeYear;
  const householdPeople = await db.select().from(people).where(eq(people.householdId, household.id)).orderBy(asc(people.sortOrder), asc(people.id));
  const warnings: EstimateWarning[] = [];
  const blockingReasons: string[] = [];
  if (year.year !== 2026) blockingReasons.push("Tax Estimate currently supports the 2026 tax year only.");
  if (householdPeople.length !== 2) blockingReasons.push("Tax Estimate currently supports a household with exactly two people.");

  const [savedSettings] = await db.select().from(taxEstimateSettings).where(eq(taxEstimateSettings.taxYearId, year.id));
  const studyRows = await db.select().from(taxEstimatePersonInputs).where(eq(taxEstimatePersonInputs.taxYearId, year.id));
  const defaultClaimant = householdPeople[0]?.id ?? 0;
  const settings = {
    manitobaCreditsClaimantPersonId: savedSettings?.manitobaCreditsClaimantPersonId ?? defaultClaimant,
    housingMode: savedSettings?.housingMode ?? "none" as const,
    homeOwnershipStartDate: savedSettings?.homeOwnershipStartDate ?? null,
    eligibleSchoolTaxCents: savedSettings?.eligibleSchoolTaxCents ?? null,
    homeownerAdvanceReceivedCents: savedSettings?.homeownerAdvanceReceivedCents ?? null,
    study: householdPeople.map((person) => {
      const row = studyRows.find((item) => item.personId === person.id);
      return { personId: person.id, fullTimeStudyMonths: row?.fullTimeStudyMonths ?? 0, partTimeStudyMonths: row?.partTimeStudyMonths ?? 0 };
    }),
  };

  if (blockingReasons.length) return { household, year, supported: false as const, blockingReasons, settings, warnings, rulePack: rules2026Manitoba };
  if (!savedSettings) warnings.push({ code: "MISSING_ESTIMATE_SETTINGS", message: "Review the Manitoba claimant, housing, and tuition settings." });

  const itemRows = await db.select().from(taxItems).where(eq(taxItems.taxYearId, year.id));
  const unmappedItems = itemRows.filter((item) => item.taxTreatment === null && item.type !== "other" && ((item.actualAmountCents ?? 0) > 0 || (item.expectedAmountCents ?? 0) > 0));
  for (const item of unmappedItems) warnings.push({ code: "UNMAPPED_ITEM", message: `${item.name} is not included because it has no Tax treatment.`, itemId: item.id });
  for (const item of itemRows.filter((row) => row.taxTreatment && row.valueSource !== "paycheques" && row.actualAmountCents === null && row.expectedAmountCents === null)) {
    warnings.push({ code: "MISSING_ITEM_AMOUNT", message: `${item.name} has a Tax treatment but no usable amount.`, itemId: item.id });
  }

  const studyByPerson = new Map(settings.study.map((item) => [item.personId, item]));
  const actualPeople = new Map(householdPeople.map((person) => [person.id, emptyPerson(person.id, person.name)]));
  const projectedPeople = new Map(householdPeople.map((person) => [person.id, emptyPerson(person.id, person.name)]));
  for (const person of householdPeople) {
    const study = studyByPerson.get(person.id)!;
    Object.assign(actualPeople.get(person.id)!, study);
    Object.assign(projectedPeople.get(person.id)!, study);
  }

  let actualMedical = 0;
  let projectedMedical = 0;
  let actualRent = 0;
  let projectedRent = 0;
  const manualSources: Array<{ id: number; name: string; treatment: TaxTreatment; personId: number | null; actualCents: number; projectedCents: number }> = [];
  for (const item of itemRows) {
    const treatment = item.taxTreatment;
    if (!treatment || treatment === "employment_income") continue;
    const actual = item.actualAmountCents ?? 0;
    const projected = projectedManualAmount(item);
    manualSources.push({ id: item.id, name: item.name, treatment, personId: item.personId, actualCents: actual, projectedCents: projected });
    if (treatment === "medical_expense") { actualMedical += actual; projectedMedical += projected; continue; }
    if (treatment === "manitoba_eligible_rent") { actualRent += actual; projectedRent += projected; continue; }
    if (!item.personId) continue;
    addPersonAmount(actualPeople.get(item.personId)!, treatment, actual);
    addPersonAmount(projectedPeople.get(item.personId)!, treatment, projected);
  }

  const employmentRows = await db.select().from(employments).where(eq(employments.taxYearId, year.id));
  const employmentSources: Array<{ id: number; employerName: string; personId: number; status: string; actualGrossCents: number; projectedGrossCents: number; paycheques: Array<{ id: number; payDate: string; grossPayCents: number; incomeTaxCents: number; cppCents: number; cpp2Cents: number; eiCents: number }> }> = [];
  for (const employment of employmentRows) {
    const cheques = await db.select().from(paycheques).where(eq(paycheques.employmentId, employment.id)).orderBy(asc(paycheques.payDate), asc(paycheques.id));
    if (employment.status === "active" && cheques.length === 0) warnings.push({ code: "ACTIVE_EMPLOYMENT_WITHOUT_PAYCHEQUES", message: `${employment.employerName} has no paycheques, so its income and withholding projection is incomplete.`, itemId: employment.taxItemId });
    const projection = calculateEmploymentProjection({ year: year.year, status: employment.status, payFrequency: employment.payFrequency, typicalGrossOverrideCents: employment.typicalGrossOverrideCents, grossPaysCents: cheques.map((row) => row.grossPayCents), latestPayDate: cheques.at(-1)?.payDate ?? null });
    const actual = actualPeople.get(employment.personId)!;
    const projected = projectedPeople.get(employment.personId)!;
    const sums = cheques.reduce((sum, row) => ({ tax: sum.tax + row.incomeTaxCents, cpp: sum.cpp + row.cppCents, cpp2: sum.cpp2 + row.cpp2Cents, ei: sum.ei + row.eiCents }), { tax: 0, cpp: 0, cpp2: 0, ei: 0 });
    employmentSources.push({ id: employment.id, employerName: employment.employerName, personId: employment.personId, status: employment.status, actualGrossCents: projection.actualGrossCents, projectedGrossCents: projection.projectedGrossCents, paycheques: cheques.map((row) => ({ id: row.id, payDate: row.payDate, grossPayCents: row.grossPayCents, incomeTaxCents: row.incomeTaxCents, cppCents: row.cppCents, cpp2Cents: row.cpp2Cents, eiCents: row.eiCents })) });
    actual.employmentIncomeCents += projection.actualGrossCents;
    actual.incomeTaxWithheldCents += sums.tax; actual.cppCents += sums.cpp; actual.cpp2Cents += sums.cpp2; actual.eiCents += sums.ei;
    projected.employmentIncomeCents += projection.projectedGrossCents;
    const futureGross = Math.max(0, projection.projectedGrossCents - projection.actualGrossCents);
    const ratio = (value: number) => projection.actualGrossCents > 0 ? Math.round(value + futureGross * value / projection.actualGrossCents) : value;
    projected.incomeTaxWithheldCents += ratio(sums.tax);
    projected.cppCents += Math.min(ratio(sums.cpp), rules2026Manitoba.cpp.maximumCppCents);
    projected.cpp2Cents += Math.min(ratio(sums.cpp2), rules2026Manitoba.cpp.maximumCpp2Cents);
    projected.eiCents += Math.min(ratio(sums.ei), rules2026Manitoba.ei.maximumPremiumCents);
  }

  for (const person of projectedPeople.values()) {
    const adjustment = scenario?.people.find((item) => item.personId === person.id);
    person.rrspDeductionCents = projectedDeduction(person.rrspDeductionCents, adjustment, "rrsp");
    person.fhsaDeductionCents = projectedDeduction(person.fhsaDeductionCents, adjustment, "fhsa");
  }

  const rentItemIds = itemRows.filter((item) => item.taxTreatment === "manitoba_eligible_rent").map((item) => item.id);
  const rentRecords = rentItemIds.length ? await db.select().from(records).where(inArray(records.taxItemId, rentItemIds)) : [];
  const recordedRentMonths = new Set<string>();
  for (const record of rentRecords) {
    if (record.date.startsWith("2026-")) recordedRentMonths.add(record.date.slice(0, 7));
    else warnings.push({ code: "RENT_RECORD_OUTSIDE_YEAR", message: `${record.description} is outside 2026 and does not establish an eligible rental month.`, itemId: record.taxItemId });
  }
  if (rentItemIds.length && recordedRentMonths.size === 0) warnings.push({ code: "RENT_WITHOUT_IN_YEAR_RECORDS", message: "Eligible rent is recorded, but no 2026 Record establishes an eligible rental month." });

  const owns = settings.housingMode === "homeowner" || settings.housingMode === "rent_then_own";
  const startDate = settings.housingMode === "homeowner" ? "2026-01-01" : settings.homeOwnershipStartDate;
  const eligibleRentMonths = new Set<string>();
  if (settings.housingMode === "renter") {
    for (const month of recordedRentMonths) eligibleRentMonths.add(month);
  } else if (settings.housingMode === "rent_then_own" && startDate) {
    const ownershipMonth = startDate.slice(0, 7);
    let hasOverlap = false;
    for (const month of recordedRentMonths) {
      if (month < ownershipMonth) eligibleRentMonths.add(month);
      else hasOverlap = true;
    }
    if (hasOverlap) warnings.push({ code: "HOUSING_PERIOD_OVERLAP", message: "One or more rental Records overlap the home-ownership period; those months are excluded until the transition is reviewed." });
  }
  let homeOwnershipDays = 0;
  if (owns && startDate) {
    const start = new Date(`${startDate}T00:00:00Z`);
    homeOwnershipDays = Math.max(0, Math.round((Date.UTC(2026, 11, 31) - start.getTime()) / 86_400_000) + 1);
  }
  if (owns && settings.eligibleSchoolTaxCents === null) warnings.push({ code: "MISSING_HOMEOWNER_DATA", message: "Enter eligible school tax to calculate the homeowner credit." });
  warnings.push({ code: "PENSIONABLE_INSURABLE_ASSUMPTION", message: "Employment gross is assumed to be pensionable and insurable for this planning estimate." });

  const rentEnabled = settings.housingMode === "renter" || settings.housingMode === "rent_then_own";
  const actualCredits = { claimantPersonId: settings.manitobaCreditsClaimantPersonId, medicalExpensesCents: actualMedical, eligibleRentCents: rentEnabled ? actualRent : 0, eligibleRentMonths: eligibleRentMonths.size, eligibleSchoolTaxCents: settings.eligibleSchoolTaxCents ?? 0, homeownerAdvanceReceivedCents: settings.homeownerAdvanceReceivedCents ?? 0, homeOwnershipDays };
  const projectedCredits = { ...actualCredits, medicalExpensesCents: projectedMedical, eligibleRentCents: projectedRent };
  const actual = calculateHouseholdEstimate([...actualPeople.values()], actualCredits);
  const projected = calculateHouseholdEstimate([...projectedPeople.values()], projectedCredits);
  return {
    household, year, supported: true as const, blockingReasons, settings, warnings,
    incomplete: warnings.some((warning) => warning.code !== "PENSIONABLE_INSURABLE_ASSUMPTION"),
    excludedItems: unmappedItems.map((item) => ({ id: item.id, name: item.name })),
    sources: { taxItems: manualSources, employments: employmentSources },
    inputs: { actual: actualCredits, projected: projectedCredits },
    actual, projected, rentMonths: [...eligibleRentMonths].sort(), rulePack: rules2026Manitoba,
  };
}

export async function saveTaxEstimateSettings(db: Database, input: EstimateSettingsInput) {
  const household = await requireHousehold(db);
  const year = await requireActiveYear(db, household.id);
  const validPeople = await db.select({ id: people.id }).from(people).where(eq(people.householdId, household.id));
  const validIds = new Set(validPeople.map((person) => person.id));
  if (!validIds.has(input.manitobaCreditsClaimantPersonId) || input.study.length !== validIds.size || input.study.some((row) => !validIds.has(row.personId))) throw new Error("Choose valid household members for estimate settings.");
  await db.transaction(async (tx) => {
    const settingsValues = { taxYearId: year.id, manitobaCreditsClaimantPersonId: input.manitobaCreditsClaimantPersonId, housingMode: input.housingMode, homeOwnershipStartDate: input.homeOwnershipStartDate, eligibleSchoolTaxCents: input.eligibleSchoolTaxCents, homeownerAdvanceReceivedCents: input.homeownerAdvanceReceivedCents };
    await tx.insert(taxEstimateSettings).values(settingsValues).onConflictDoUpdate({ target: taxEstimateSettings.taxYearId, set: settingsValues });
    await tx.delete(taxEstimatePersonInputs).where(eq(taxEstimatePersonInputs.taxYearId, year.id));
    if (input.study.length) await tx.insert(taxEstimatePersonInputs).values(input.study.map((row) => ({ taxYearId: year.id, ...row })));
  });
  return { success: true };
}
