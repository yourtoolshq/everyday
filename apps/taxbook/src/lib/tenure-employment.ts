import type { PayFrequency } from "~/domain/employment";
import type { TenureIntegrationEmployment } from "~/lib/tenure-client";

export type TenureDeductionSettings = {
  incomeTaxEnabled: boolean;
  federalIncomeTaxEnabled: boolean;
  manitobaIncomeTaxEnabled: boolean;
  cppEnabled: boolean;
  cpp2Enabled: boolean;
  eiEnabled: boolean;
  wiEnabled: boolean;
  ltdEnabled: boolean;
  extendedHealthEnabled: boolean;
  travelMedicalEnabled: boolean;
  unionDuesEnabled: boolean;
  otherDeductionsEnabled: boolean;
  deductionFieldOrder: string[] | null;
};

export function parseTenureDeductionSettings(
  value: string | null | undefined,
): TenureDeductionSettings {
  if (!value) {
    return {
      incomeTaxEnabled: true,
      federalIncomeTaxEnabled: false,
      manitobaIncomeTaxEnabled: false,
      cppEnabled: true,
      cpp2Enabled: true,
      eiEnabled: true,
      wiEnabled: false,
      ltdEnabled: false,
      extendedHealthEnabled: false,
      travelMedicalEnabled: false,
      unionDuesEnabled: false,
      otherDeductionsEnabled: true,
      deductionFieldOrder: null,
    };
  }

  try {
    const parsed = JSON.parse(value) as Partial<TenureDeductionSettings>;
    return {
      incomeTaxEnabled: parsed.incomeTaxEnabled ?? true,
      federalIncomeTaxEnabled: parsed.federalIncomeTaxEnabled ?? false,
      manitobaIncomeTaxEnabled: parsed.manitobaIncomeTaxEnabled ?? false,
      cppEnabled: parsed.cppEnabled ?? true,
      cpp2Enabled: parsed.cpp2Enabled ?? true,
      eiEnabled: parsed.eiEnabled ?? true,
      wiEnabled: parsed.wiEnabled ?? false,
      ltdEnabled: parsed.ltdEnabled ?? false,
      extendedHealthEnabled: parsed.extendedHealthEnabled ?? false,
      travelMedicalEnabled: parsed.travelMedicalEnabled ?? false,
      unionDuesEnabled: parsed.unionDuesEnabled ?? false,
      otherDeductionsEnabled: parsed.otherDeductionsEnabled ?? true,
      deductionFieldOrder: parsed.deductionFieldOrder ?? null,
    };
  } catch {
    return parseTenureDeductionSettings(undefined);
  }
}

export function normalizePersonName(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveTenurePersonId(input: {
  tenurePersonId: string;
  tenurePersonName: string;
  householdPeople: Array<{ id: number; name: string }>;
  personMappings: Record<string, number>;
}): { personId: number | null; matchKind: "mapped" | "name" | null } {
  const mapped = input.personMappings[input.tenurePersonId];
  if (mapped) {
    const person = input.householdPeople.find((item) => item.id === mapped);
    if (person) return { personId: person.id, matchKind: "mapped" };
  }

  const byName = input.householdPeople.find(
    (person) =>
      normalizePersonName(person.name) ===
      normalizePersonName(input.tenurePersonName),
  );
  if (byName) return { personId: byName.id, matchKind: "name" };

  return { personId: null, matchKind: null };
}

export function employmentOverlapsTaxYear(
  employment: Pick<
    TenureIntegrationEmployment,
    "status" | "startDate" | "endDate"
  >,
  taxYear: number,
): boolean {
  const yearStart = `${taxYear}-01-01`;
  const yearEnd = `${taxYear}-12-31`;

  if (employment.startDate && employment.startDate > yearEnd) return false;
  if (employment.endDate && employment.endDate < yearStart) return false;
  return true;
}

export function mapTenureEmploymentStatus(
  employment: Pick<TenureIntegrationEmployment, "status" | "endDate">,
  taxYear: number,
): { status: "active" | "ended"; endDate: string | null } {
  if (employment.status === "current") {
    return { status: "active", endDate: null };
  }

  const endDate = employment.endDate;
  if (!endDate) {
    return { status: "ended", endDate: `${taxYear}-12-31` };
  }

  if (endDate < `${taxYear}-01-01`) {
    return { status: "ended", endDate };
  }

  if (endDate > `${taxYear}-12-31`) {
    return { status: "active", endDate: null };
  }

  return { status: "ended", endDate };
}

export function mapTenurePayFrequency(value: string): PayFrequency {
  if (
    value === "weekly" ||
    value === "biweekly" ||
    value === "semimonthly" ||
    value === "monthly" ||
    value === "irregular"
  ) {
    return value;
  }
  return "irregular";
}

export function mapTenureEmploymentInput(
  tenure: TenureIntegrationEmployment,
  taxYear: number,
  personId: number,
) {
  const deductions = parseTenureDeductionSettings(tenure.deductionSettings);
  const lifecycle = mapTenureEmploymentStatus(tenure, taxYear);

  return {
    personId,
    employerName: tenure.employerName,
    payFrequency: mapTenurePayFrequency(tenure.payFrequency),
    status: lifecycle.status,
    endDate: lifecycle.endDate,
    typicalGrossOverrideCents: null,
    phspReportedOnT4: false,
    unionDuesReportedOnT4: deductions.unionDuesEnabled,
    ...deductions,
  };
}
