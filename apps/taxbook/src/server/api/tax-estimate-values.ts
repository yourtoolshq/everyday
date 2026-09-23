import { asc, eq, inArray } from "drizzle-orm";

import type { Database } from "./helpers";
import type { PersonEstimateInput } from "~/domain/tax-calculator";
import type { EstimateWarning, ScenarioInput } from "~/domain/tax-estimate";
import { calculateEmploymentProjection } from "~/domain/employment";
import { calculateHouseholdEstimate } from "~/domain/tax-calculator";
import { projectedManualAmount } from "~/domain/tax-estimate";
import { type TaxTreatment } from "~/domain/tax-item";
import { rules2026Manitoba } from "~/domain/tax-rules/2026-manitoba";
import {
  employments,
  paycheques,
  people,
  records,
  taxItems,
} from "~/server/db/schema";
import { requireActiveYear, requireHousehold } from "./helpers";

type ScenarioPerson = ScenarioInput["people"][number];

function emptyPerson(id: number, name: string): PersonEstimateInput {
  return {
    id,
    name,
    employmentIncomeCents: 0,
    interestIncomeCents: 0,
    selfEmploymentIncomeCents: 0,
    rrspDeductionCents: 0,
    fhsaDeductionCents: 0,
    professionalDuesCents: 0,
    incomeTaxWithheldCents: 0,
    cppCents: 0,
    cpp2Cents: 0,
    eiCents: 0,
    currentTuitionCents: 0,
    federalTuitionCarryforwardCents: 0,
    manitobaTuitionCarryforwardCents: 0,
  };
}

const treatmentField: Partial<Record<TaxTreatment, keyof PersonEstimateInput>> =
  {
    interest_income: "interestIncomeCents",
    self_employment_income: "selfEmploymentIncomeCents",
    rrsp_deduction: "rrspDeductionCents",
    fhsa_deduction: "fhsaDeductionCents",
    professional_dues: "professionalDuesCents",
    current_tuition: "currentTuitionCents",
    federal_tuition_carryforward: "federalTuitionCarryforwardCents",
    manitoba_tuition_carryforward: "manitobaTuitionCarryforwardCents",
  };

function addPersonAmount(
  person: PersonEstimateInput,
  treatment: TaxTreatment,
  amount: number,
) {
  const field = treatmentField[treatment];
  if (!field) return;
  (person[field] as number) += amount;
}

function projectedDeduction(
  total: number,
  scenario: ScenarioPerson | undefined,
  kind: "rrsp" | "fhsa",
) {
  return (
    total +
    (kind === "rrsp"
      ? (scenario?.rrspDeductionCents ?? 0)
      : (scenario?.fhsaDeductionCents ?? 0))
  );
}

export async function buildTaxEstimate(
  db: Database,
  scenario?: ScenarioInput,
  requestedTaxYearId?: number,
) {
  const household = await requireHousehold(db);
  const activeYear = await requireActiveYear(db, household.id);
  const requestedYear = requestedTaxYearId
    ? await db.query.taxYears.findFirst({
        where: (table, operators) =>
          operators.and(
            operators.eq(table.id, requestedTaxYearId),
            operators.eq(table.householdId, household.id),
          ),
      })
    : null;
  const year = requestedYear ?? activeYear;
  const householdPeople = await db
    .select()
    .from(people)
    .where(eq(people.householdId, household.id))
    .orderBy(asc(people.sortOrder), asc(people.id));
  const warnings: EstimateWarning[] = [];
  const blockingReasons: string[] = [];
  if (year.year !== 2026)
    blockingReasons.push(
      "Tax Estimate currently supports the 2026 tax year only.",
    );
  if (householdPeople.length !== 2)
    blockingReasons.push(
      "Tax Estimate currently supports a household with exactly two people.",
    );

  const defaultClaimant = householdPeople[0]?.id ?? 0;

  if (blockingReasons.length)
    return {
      household,
      year,
      supported: false as const,
      blockingReasons,
      warnings,
      rulePack: rules2026Manitoba,
    };

  const itemRows = await db
    .select()
    .from(taxItems)
    .where(eq(taxItems.taxYearId, year.id));
  const unmappedItems = itemRows.filter(
    (item) =>
      item.taxTreatment === null &&
      item.type !== "other" &&
      ((item.actualAmountCents ?? 0) > 0 ||
        (item.expectedAmountCents ?? 0) > 0),
  );
  for (const item of unmappedItems)
    warnings.push({
      code: "UNMAPPED_ITEM",
      message: `${item.name} is not included because it has no Tax treatment.`,
      itemId: item.id,
    });
  for (const item of itemRows.filter(
    (row) =>
      row.taxTreatment &&
      row.valueSource !== "paycheques" &&
      row.actualAmountCents === null &&
      row.expectedAmountCents === null,
  )) {
    warnings.push({
      code: "MISSING_ITEM_AMOUNT",
      message: `${item.name} has a Tax treatment but no usable amount.`,
      itemId: item.id,
    });
  }

  const actualPeople = new Map(
    householdPeople.map((person) => [
      person.id,
      emptyPerson(person.id, person.name),
    ]),
  );
  const projectedPeople = new Map(
    householdPeople.map((person) => [
      person.id,
      emptyPerson(person.id, person.name),
    ]),
  );

  let actualMedical = 0;
  let projectedMedical = 0;
  let actualRent = 0,
    projectedRent = 0;
  let actualSchoolTax = 0,
    projectedSchoolTax = 0;
  let actualHomeownerAdvance = 0,
    projectedHomeownerAdvance = 0;
  const manualSources: Array<{
    id: number;
    name: string;
    treatment: TaxTreatment;
    personId: number | null;
    actualCents: number;
    projectedCents: number;
  }> = [];
  for (const item of itemRows) {
    const treatment = item.taxTreatment;
    if (!treatment || treatment === "employment_income") continue;
    const actual = item.actualAmountCents ?? 0;
    const projected = projectedManualAmount(item);
    manualSources.push({
      id: item.id,
      name: item.name,
      treatment,
      personId: item.personId,
      actualCents: actual,
      projectedCents: projected,
    });
    if (treatment === "medical_expense") {
      actualMedical += actual;
      projectedMedical += projected;
      continue;
    }
    if (treatment === "manitoba_eligible_rent") {
      actualRent += actual;
      projectedRent += projected;
      continue;
    }
    if (treatment === "manitoba_eligible_school_tax") {
      actualSchoolTax += actual;
      projectedSchoolTax += projected;
      continue;
    }
    if (treatment === "manitoba_homeowner_advance") {
      actualHomeownerAdvance += actual;
      projectedHomeownerAdvance += projected;
      continue;
    }
    if (!item.personId) continue;
    addPersonAmount(actualPeople.get(item.personId)!, treatment, actual);
    addPersonAmount(projectedPeople.get(item.personId)!, treatment, projected);
  }

  const employmentRows = await db
    .select()
    .from(employments)
    .where(eq(employments.taxYearId, year.id));
  const employmentSources: Array<{
    id: number;
    employerName: string;
    personId: number;
    status: string;
    actualGrossCents: number;
    projectedGrossCents: number;
    paycheques: Array<{
      id: number;
      payDate: string;
      grossPayCents: number;
      incomeTaxCents: number;
      cppCents: number;
      cpp2Cents: number;
      eiCents: number;
    }>;
  }> = [];
  for (const employment of employmentRows) {
    const cheques = await db
      .select()
      .from(paycheques)
      .where(eq(paycheques.employmentId, employment.id))
      .orderBy(asc(paycheques.payDate), asc(paycheques.id));
    if (employment.status === "active" && cheques.length === 0)
      warnings.push({
        code: "ACTIVE_EMPLOYMENT_WITHOUT_PAYCHEQUES",
        message: `${employment.employerName} has no paycheques, so its income and withholding projection is incomplete.`,
        itemId: employment.taxItemId,
      });
    const projection = calculateEmploymentProjection({
      year: year.year,
      status: employment.status,
      payFrequency: employment.payFrequency,
      typicalGrossOverrideCents: employment.typicalGrossOverrideCents,
      grossPaysCents: cheques.map((row) => row.grossPayCents),
      latestPayDate: cheques.at(-1)?.payDate ?? null,
    });
    const actual = actualPeople.get(employment.personId)!;
    const projected = projectedPeople.get(employment.personId)!;
    const sums = cheques.reduce(
      (sum, row) => ({
        tax: sum.tax + row.incomeTaxCents,
        cpp: sum.cpp + row.cppCents,
        cpp2: sum.cpp2 + row.cpp2Cents,
        ei: sum.ei + row.eiCents,
      }),
      { tax: 0, cpp: 0, cpp2: 0, ei: 0 },
    );
    employmentSources.push({
      id: employment.id,
      employerName: employment.employerName,
      personId: employment.personId,
      status: employment.status,
      actualGrossCents: projection.actualGrossCents,
      projectedGrossCents: projection.projectedGrossCents,
      paycheques: cheques.map((row) => ({
        id: row.id,
        payDate: row.payDate,
        grossPayCents: row.grossPayCents,
        incomeTaxCents: row.incomeTaxCents,
        cppCents: row.cppCents,
        cpp2Cents: row.cpp2Cents,
        eiCents: row.eiCents,
      })),
    });
    actual.employmentIncomeCents += projection.actualGrossCents;
    actual.incomeTaxWithheldCents += sums.tax;
    actual.cppCents += sums.cpp;
    actual.cpp2Cents += sums.cpp2;
    actual.eiCents += sums.ei;
    projected.employmentIncomeCents += projection.projectedGrossCents;
    const futureGross = Math.max(
      0,
      projection.projectedGrossCents - projection.actualGrossCents,
    );
    const ratio = (value: number) =>
      projection.actualGrossCents > 0
        ? Math.round(
            value + (futureGross * value) / projection.actualGrossCents,
          )
        : value;
    projected.incomeTaxWithheldCents += ratio(sums.tax);
    projected.cppCents += Math.min(
      ratio(sums.cpp),
      rules2026Manitoba.cpp.maximumCppCents,
    );
    projected.cpp2Cents += Math.min(
      ratio(sums.cpp2),
      rules2026Manitoba.cpp.maximumCpp2Cents,
    );
    projected.eiCents += Math.min(
      ratio(sums.ei),
      rules2026Manitoba.ei.maximumPremiumCents,
    );
  }

  for (const person of projectedPeople.values()) {
    const adjustment = scenario?.people.find(
      (item) => item.personId === person.id,
    );
    person.rrspDeductionCents = projectedDeduction(
      person.rrspDeductionCents,
      adjustment,
      "rrsp",
    );
    person.fhsaDeductionCents = projectedDeduction(
      person.fhsaDeductionCents,
      adjustment,
      "fhsa",
    );
  }

  const rentItemIds = itemRows
    .filter((item) => item.taxTreatment === "manitoba_eligible_rent")
    .map((item) => item.id);
  const rentRecords = rentItemIds.length
    ? await db
        .select()
        .from(records)
        .where(inArray(records.taxItemId, rentItemIds))
    : [];
  const recordedRentMonths = new Set<string>();
  for (const record of rentRecords) {
    if (record.date.startsWith("2026-"))
      recordedRentMonths.add(record.date.slice(0, 7));
    else
      warnings.push({
        code: "RENT_RECORD_OUTSIDE_YEAR",
        message: `${record.description} is outside 2026 and does not establish an eligible rental month.`,
        itemId: record.taxItemId,
      });
  }
  if (rentItemIds.length && recordedRentMonths.size === 0)
    warnings.push({
      code: "RENT_WITHOUT_IN_YEAR_RECORDS",
      message:
        "Eligible rent is recorded, but no 2026 Record establishes an eligible rental month.",
    });

  const eligibleRentMonths = recordedRentMonths;
  const homeOwnershipDays = (schoolTaxCents: number) => {
    if (schoolTaxCents === 0) return 0;
    const lastRentMonth = [...recordedRentMonths].sort().at(-1);
    if (!lastRentMonth) return 365;
    const [yearPart, monthPart] = lastRentMonth.split("-").map(Number);
    const start = new Date(Date.UTC(yearPart!, monthPart!, 1));
    return Math.max(
      0,
      Math.round((Date.UTC(2026, 11, 31) - start.getTime()) / 86_400_000) + 1,
    );
  };
  warnings.push({
    code: "PENSIONABLE_INSURABLE_ASSUMPTION",
    message:
      "Employment gross is assumed to be pensionable and insurable for this planning estimate.",
  });
  if (itemRows.some((item) => item.taxTreatment === "self_employment_income"))
    warnings.push({
      code: "SELF_EMPLOYMENT_ASSUMPTIONS",
      message:
        "Self-employment Records are assumed deductible and net positive income is estimated using the 2026 Schedule 8 structure for 12 CPP-eligible months. Quebec, age-based CPP elections, and restricted losses are not supported.",
    });

  const actualCredits = {
    claimantPersonId: defaultClaimant,
    medicalExpensesCents: actualMedical,
    eligibleRentCents: actualRent,
    eligibleRentMonths: eligibleRentMonths.size,
    eligibleSchoolTaxCents: actualSchoolTax,
    homeownerAdvanceReceivedCents: actualHomeownerAdvance,
    homeOwnershipDays: homeOwnershipDays(actualSchoolTax),
  };
  const projectedCredits = {
    claimantPersonId: defaultClaimant,
    medicalExpensesCents: projectedMedical,
    eligibleRentCents: projectedRent,
    eligibleRentMonths: eligibleRentMonths.size,
    eligibleSchoolTaxCents: projectedSchoolTax,
    homeownerAdvanceReceivedCents: projectedHomeownerAdvance,
    homeOwnershipDays: homeOwnershipDays(projectedSchoolTax),
  };
  const actual = calculateHouseholdEstimate(
    [...actualPeople.values()],
    actualCredits,
  );
  const projected = calculateHouseholdEstimate(
    [...projectedPeople.values()],
    projectedCredits,
  );
  return {
    household,
    year,
    supported: true as const,
    blockingReasons,
    warnings,
    incomplete: warnings.some(
      (warning) => warning.code !== "PENSIONABLE_INSURABLE_ASSUMPTION",
    ),
    excludedItems: unmappedItems.map((item) => ({
      id: item.id,
      name: item.name,
    })),
    sources: { taxItems: manualSources, employments: employmentSources },
    inputs: { actual: actualCredits, projected: projectedCredits },
    actual,
    projected,
    rentMonths: [...eligibleRentMonths].sort(),
    rulePack: rules2026Manitoba,
  };
}
