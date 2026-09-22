import { describe, expect, it } from "vitest";

import {
  serializePaychequesForTenure,
  tenurePaychequeExportFilename,
} from "./paycheque-export";

describe("paycheque export", () => {
  it("serializes rows with the Tenure-friendly column names", () => {
    const csv = serializePaychequesForTenure([
      {
        payDate: "2025-01-16",
        grossPayCents: 250000,
        incomeTaxCents: 50000,
        federalIncomeTaxCents: 0,
        manitobaIncomeTaxCents: 0,
        cppCents: 10000,
        cpp2Cents: 0,
        eiCents: 5000,
        wiCents: 0,
        ltdCents: 0,
        extendedHealthCents: 0,
        travelMedicalCents: 0,
        unionDuesCents: 0,
        otherDeductionsCents: 0,
        employerName: "Acme Corp",
        personName: "Jane Doe",
      },
    ]);

    expect(csv).toContain("pay_date,gross_pay_cents,income_tax_cents");
    expect(csv).toContain("2025-01-16,250000,50000");
    expect(csv).toContain("Acme Corp,Jane Doe");
  });

  it("escapes commas in employer names", () => {
    const csv = serializePaychequesForTenure([
      {
        payDate: "2025-01-16",
        grossPayCents: 100,
        incomeTaxCents: 0,
        federalIncomeTaxCents: 0,
        manitobaIncomeTaxCents: 0,
        cppCents: 0,
        cpp2Cents: 0,
        eiCents: 0,
        wiCents: 0,
        ltdCents: 0,
        extendedHealthCents: 0,
        travelMedicalCents: 0,
        unionDuesCents: 0,
        otherDeductionsCents: 0,
        employerName: "Acme, Inc.",
        personName: "Jane Doe",
      },
    ]);

    expect(csv).toContain('"Acme, Inc."');
  });

  it("builds a stable export filename", () => {
    expect(
      tenurePaychequeExportFilename({
        employerName: "Acme Corp",
        taxYear: 2025,
      }),
    ).toBe("taxbook-paycheques-acme-corp-2025.csv");
  });
});
