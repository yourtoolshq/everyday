import { describe, expect, it } from "vitest";

import {
  buildPaycheckImportPreview,
  detectPaycheckColumnMapping,
  paycheckImportRowToInput,
} from "~/lib/paycheck-csv-import";

const lifecycle = {
  startDate: "2025-01-01",
  endDate: null,
  status: "current" as const,
};

const csv = `pay_date,gross_pay_cents,income_tax_cents,federal_income_tax_cents,manitoba_income_tax_cents,cpp_cents,cpp2_cents,ei_cents,wi_cents,ltd_cents,extended_health_cents,travel_medical_cents,union_dues_cents,other_deductions_cents,employer_name,person_name
2025-01-20,250000,50000,0,0,10000,0,5000,0,0,0,0,0,0,Acme Corp,Jane Doe
2025-02-03,250000,50000,0,0,10000,0,5000,0,0,0,0,0,0,Acme Corp,Jane Doe`;

describe("paycheck csv import", () => {
  it("detects the Taxbook export preset", () => {
    const headers = csv.split("\n")[0]!.split(",");
    const mapping = detectPaycheckColumnMapping(headers);

    expect(mapping.payDate).toBe("pay_date");
    expect(mapping.grossPayCents).toBe("gross_pay_cents");
  });

  it("derives pay periods from pay dates when columns are missing", () => {
    const mapping = detectPaycheckColumnMapping(csv.split("\n")[0]!.split(","));
    const preview = buildPaycheckImportPreview({
      csvText: csv,
      mapping,
      lifecycle,
      payFrequency: "biweekly",
      biweeklyAnchorDate: "2025-01-03",
      existingPaychecks: [],
    });

    expect(preview.validCount).toBe(2);
    expect(preview.rows[0]?.periodStrategy).toBe("derived");
    expect(preview.rows[0]?.periodStartDate).toBe("2025-01-03");
    expect(preview.rows[0]?.periodEndDate).toBe("2025-01-16");
    expect(preview.estimatedPeriodCount).toBe(2);
  });

  it("flags duplicates against existing paychecks", () => {
    const mapping = detectPaycheckColumnMapping(csv.split("\n")[0]!.split(","));
    const preview = buildPaycheckImportPreview({
      csvText: csv,
      mapping,
      lifecycle,
      payFrequency: "biweekly",
      biweeklyAnchorDate: "2025-01-03",
      existingPaychecks: [{ payDate: "2025-01-20", grossPayCents: 250000 }],
    });

    expect(preview.duplicateCount).toBe(1);
    expect(preview.rows[0]?.isDuplicate).toBe(true);
  });

  it("builds valid paycheck input from preview rows", () => {
    const mapping = detectPaycheckColumnMapping(csv.split("\n")[0]!.split(","));
    const preview = buildPaycheckImportPreview({
      csvText: csv,
      mapping,
      lifecycle,
      payFrequency: "biweekly",
      biweeklyAnchorDate: "2025-01-03",
      existingPaychecks: [],
    });

    const input = paycheckImportRowToInput(
      "00000000-0000-4000-8000-000000000001",
      preview.rows[0]!,
    );

    expect(input.payDate).toBe("2025-01-20");
    expect(input.grossPayCents).toBe(250000);
  });
});
