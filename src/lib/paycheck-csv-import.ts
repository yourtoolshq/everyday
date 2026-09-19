import {
  canDerivePayPeriods,
  findExpectedPeriodForPayDate,
  type EmploymentLifecycle,
} from "~/lib/expected-pay-periods";
import type { PayFrequency } from "~/lib/pay-frequency";
import { paycheckInput } from "~/lib/paycheck-deductions";

export const paycheckImportFields = [
  "payDate",
  "periodStartDate",
  "periodEndDate",
  "grossPayCents",
  "incomeTaxCents",
  "federalIncomeTaxCents",
  "manitobaIncomeTaxCents",
  "cppCents",
  "cpp2Cents",
  "eiCents",
  "wiCents",
  "ltdCents",
  "extendedHealthCents",
  "travelMedicalCents",
  "unionDuesCents",
  "otherDeductionsCents",
] as const;

export type PaycheckImportField = (typeof paycheckImportFields)[number];

export type PaycheckColumnMapping = Partial<Record<PaycheckImportField, string>>;

export type PaycheckImportPeriodStrategy = "mapped" | "derived" | "pay_date_fallback";

export type PaycheckImportPreviewRow = {
  rowNumber: number;
  payDate: string;
  periodStartDate: string;
  periodEndDate: string;
  periodStrategy: PaycheckImportPeriodStrategy;
  grossPayCents: number;
  incomeTaxCents: number;
  federalIncomeTaxCents: number;
  manitobaIncomeTaxCents: number;
  cppCents: number;
  cpp2Cents: number;
  eiCents: number;
  wiCents: number;
  ltdCents: number;
  extendedHealthCents: number;
  travelMedicalCents: number;
  unionDuesCents: number;
  otherDeductionsCents: number;
  isDuplicate: boolean;
  errors: string[];
  warnings: string[];
};

export type PaycheckImportPreview = {
  headers: string[];
  mapping: PaycheckColumnMapping;
  rows: PaycheckImportPreviewRow[];
  validCount: number;
  duplicateCount: number;
  errorCount: number;
  estimatedPeriodCount: number;
};

const taxbookPresetMapping: PaycheckColumnMapping = {
  payDate: "pay_date",
  grossPayCents: "gross_pay_cents",
  incomeTaxCents: "income_tax_cents",
  federalIncomeTaxCents: "federal_income_tax_cents",
  manitobaIncomeTaxCents: "manitoba_income_tax_cents",
  cppCents: "cpp_cents",
  cpp2Cents: "cpp2_cents",
  eiCents: "ei_cents",
  wiCents: "wi_cents",
  ltdCents: "ltd_cents",
  extendedHealthCents: "extended_health_cents",
  travelMedicalCents: "travel_medical_cents",
  unionDuesCents: "union_dues_cents",
  otherDeductionsCents: "other_deductions_cents",
  periodStartDate: "period_start_date",
  periodEndDate: "period_end_date",
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(current);
      current = "";
      continue;
    }

    if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      current = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

export function detectPaycheckColumnMapping(headers: string[]): PaycheckColumnMapping {
  const normalized = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const mapping: PaycheckColumnMapping = {};

  for (const [field, presetHeader] of Object.entries(taxbookPresetMapping)) {
    const header = normalized.get(presetHeader);
    if (header) {
      mapping[field as PaycheckImportField] = header;
    }
  }

  return mapping;
}

function parseInteger(value: string | undefined, fieldLabel: string, errors: string[]): number {
  if (!value || value.trim().length === 0) return 0;
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < 0) {
    errors.push(`${fieldLabel} must be a non-negative whole number.`);
    return 0;
  }
  return parsed;
}

function parseDate(value: string | undefined, fieldLabel: string, errors: string[]): string | null {
  if (!value || value.trim().length === 0) {
    errors.push(`${fieldLabel} is required.`);
    return null;
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    errors.push(`${fieldLabel} must use YYYY-MM-DD format.`);
    return null;
  }
  const [year, month, day] = trimmed.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  if (date.toISOString().slice(0, 10) !== trimmed) {
    errors.push(`${fieldLabel} is not a valid date.`);
    return null;
  }
  return trimmed;
}

function resolvePeriod(
  payDate: string,
  mappedPeriodStart: string | null,
  mappedPeriodEnd: string | null,
  lifecycle: EmploymentLifecycle,
  payFrequency: PayFrequency,
  biweeklyAnchorDate: string | null,
  warnings: string[],
): {
  periodStartDate: string;
  periodEndDate: string;
  periodStrategy: PaycheckImportPeriodStrategy;
} {
  if (mappedPeriodStart && mappedPeriodEnd) {
    if (mappedPeriodEnd < mappedPeriodStart) {
      warnings.push("Pay period end is before the start date.");
    }
    return {
      periodStartDate: mappedPeriodStart,
      periodEndDate: mappedPeriodEnd,
      periodStrategy: "mapped",
    };
  }

  if (canDerivePayPeriods(lifecycle, payFrequency)) {
    const period = findExpectedPeriodForPayDate(
      lifecycle,
      payFrequency,
      biweeklyAnchorDate,
      payDate,
    );
    if (period) {
      warnings.push("Pay period estimated from pay date and employment schedule.");
      return {
        periodStartDate: period.periodStartDate,
        periodEndDate: period.periodEndDate,
        periodStrategy: "derived",
      };
    }
  }

  warnings.push("Pay period set to pay date only. Review after import.");
  return {
    periodStartDate: payDate,
    periodEndDate: payDate,
    periodStrategy: "pay_date_fallback",
  };
}

export function buildPaycheckImportPreview(input: {
  csvText: string;
  mapping: PaycheckColumnMapping;
  lifecycle: EmploymentLifecycle;
  payFrequency: PayFrequency;
  biweeklyAnchorDate: string | null;
  existingPaychecks: Array<{ payDate: string; grossPayCents: number }>;
}): PaycheckImportPreview {
  const table = parseCsv(input.csvText.trim());
  if (table.length === 0) {
    return {
      headers: [],
      mapping: input.mapping,
      rows: [],
      validCount: 0,
      duplicateCount: 0,
      errorCount: 0,
      estimatedPeriodCount: 0,
    };
  }

  const headers = table[0] ?? [];
  const headerIndex = new Map(headers.map((header, index) => [header, index]));

  const rows: PaycheckImportPreviewRow[] = [];

  for (let rowIndex = 1; rowIndex < table.length; rowIndex += 1) {
    const cells = table[rowIndex] ?? [];
    const read = (field: PaycheckImportField) => {
      const header = input.mapping[field];
      if (!header) return undefined;
      const columnIndex = headerIndex.get(header);
      if (columnIndex === undefined) return undefined;
      return cells[columnIndex];
    };

    const errors: string[] = [];
    const warnings: string[] = [];
    const payDate = parseDate(read("payDate"), "Pay date", errors);
    const mappedPeriodStart = read("periodStartDate")
      ? parseDate(read("periodStartDate"), "Pay period start", errors)
      : null;
    const mappedPeriodEnd = read("periodEndDate")
      ? parseDate(read("periodEndDate"), "Pay period end", errors)
      : null;

    const amounts = {
      grossPayCents: parseInteger(read("grossPayCents"), "Gross pay", errors),
      incomeTaxCents: parseInteger(read("incomeTaxCents"), "Income tax", errors),
      federalIncomeTaxCents: parseInteger(
        read("federalIncomeTaxCents"),
        "Federal tax",
        errors,
      ),
      manitobaIncomeTaxCents: parseInteger(
        read("manitobaIncomeTaxCents"),
        "Manitoba tax",
        errors,
      ),
      cppCents: parseInteger(read("cppCents"), "CPP", errors),
      cpp2Cents: parseInteger(read("cpp2Cents"), "CPP2", errors),
      eiCents: parseInteger(read("eiCents"), "EI", errors),
      wiCents: parseInteger(read("wiCents"), "WI", errors),
      ltdCents: parseInteger(read("ltdCents"), "LTD", errors),
      extendedHealthCents: parseInteger(read("extendedHealthCents"), "Extended health", errors),
      travelMedicalCents: parseInteger(read("travelMedicalCents"), "Travel medical", errors),
      unionDuesCents: parseInteger(read("unionDuesCents"), "Union dues", errors),
      otherDeductionsCents: parseInteger(read("otherDeductionsCents"), "Other deductions", errors),
    };

    if (!payDate) {
      rows.push({
        rowNumber: rowIndex + 1,
        payDate: "",
        periodStartDate: "",
        periodEndDate: "",
        periodStrategy: "pay_date_fallback",
        ...amounts,
        isDuplicate: false,
        errors,
        warnings,
      });
      continue;
    }

    const period = resolvePeriod(
      payDate,
      mappedPeriodStart,
      mappedPeriodEnd,
      input.lifecycle,
      input.payFrequency,
      input.biweeklyAnchorDate,
      warnings,
    );

    const isDuplicate = input.existingPaychecks.some(
      (existing) =>
        existing.payDate === payDate && existing.grossPayCents === amounts.grossPayCents,
    );
    if (isDuplicate) {
      warnings.push("Matches an existing paycheck with the same pay date and gross pay.");
    }

    rows.push({
      rowNumber: rowIndex + 1,
      payDate,
      periodStartDate: period.periodStartDate,
      periodEndDate: period.periodEndDate,
      periodStrategy: period.periodStrategy,
      ...amounts,
      isDuplicate,
      errors,
      warnings,
    });
  }

  const validCount = rows.filter((row) => row.errors.length === 0).length;
  const duplicateCount = rows.filter((row) => row.isDuplicate).length;
  const errorCount = rows.filter((row) => row.errors.length > 0).length;
  const estimatedPeriodCount = rows.filter(
    (row) =>
      row.errors.length === 0 &&
      (row.periodStrategy === "derived" || row.periodStrategy === "pay_date_fallback"),
  ).length;

  return {
    headers,
    mapping: input.mapping,
    rows,
    validCount,
    duplicateCount,
    errorCount,
    estimatedPeriodCount,
  };
}

export function paycheckImportRowToInput(
  employmentId: string,
  row: PaycheckImportPreviewRow,
) {
  return paycheckInput.parse({
    employmentId,
    payDate: row.payDate,
    periodStartDate: row.periodStartDate,
    periodEndDate: row.periodEndDate,
    grossPayCents: row.grossPayCents,
    incomeTaxCents: row.incomeTaxCents,
    federalIncomeTaxCents: row.federalIncomeTaxCents,
    manitobaIncomeTaxCents: row.manitobaIncomeTaxCents,
    cppCents: row.cppCents,
    cpp2Cents: row.cpp2Cents,
    eiCents: row.eiCents,
    wiCents: row.wiCents,
    ltdCents: row.ltdCents,
    extendedHealthCents: row.extendedHealthCents,
    travelMedicalCents: row.travelMedicalCents,
    unionDuesCents: row.unionDuesCents,
    otherDeductionsCents: row.otherDeductionsCents,
  });
}

export { taxbookPresetMapping, parseCsv };
