export const tenurePaychequeExportColumns = [
  "pay_date",
  "gross_pay_cents",
  "income_tax_cents",
  "federal_income_tax_cents",
  "manitoba_income_tax_cents",
  "cpp_cents",
  "cpp2_cents",
  "ei_cents",
  "wi_cents",
  "ltd_cents",
  "extended_health_cents",
  "travel_medical_cents",
  "union_dues_cents",
  "other_deductions_cents",
  "employer_name",
  "person_name",
] as const;

export type TenurePaychequeExportRow = {
  payDate: string;
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
  employerName: string;
  personName: string;
};

function escapeCsvValue(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function serializePaychequesForTenure(rows: TenurePaychequeExportRow[]): string {
  const lines = [
    tenurePaychequeExportColumns.join(","),
    ...rows.map((row) =>
      [
        row.payDate,
        row.grossPayCents,
        row.incomeTaxCents,
        row.federalIncomeTaxCents,
        row.manitobaIncomeTaxCents,
        row.cppCents,
        row.cpp2Cents,
        row.eiCents,
        row.wiCents,
        row.ltdCents,
        row.extendedHealthCents,
        row.travelMedicalCents,
        row.unionDuesCents,
        row.otherDeductionsCents,
        row.employerName,
        row.personName,
      ]
        .map(escapeCsvValue)
        .join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

export function tenurePaychequeExportFilename(input: {
  employerName: string;
  taxYear: number;
}): string {
  const slug = input.employerName
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  const base = slug.length > 0 ? slug : "employment";
  return `taxbook-paycheques-${base}-${input.taxYear}.csv`;
}
