import { describe, expect, it } from "vitest";

import {
  enrichCompensationChanges,
  formatCompensationRate,
  getCompensationDeltaDisplay,
  getCurrentCompensationChange,
} from "~/lib/compensation";

describe("compensation", () => {
  it("returns the latest effective change on or before a date", () => {
    const changes = [
      {
        id: "1",
        employmentId: "emp",
        type: "annual_salary" as const,
        currency: "CAD" as const,
        effectiveDate: "2024-01-01",
        amountCents: 80_000_00,
        commissionBasisPoints: null,
        notes: null,
        documentId: null,
        discussionId: null,
      },
      {
        id: "2",
        employmentId: "emp",
        type: "annual_salary" as const,
        currency: "CAD" as const,
        effectiveDate: "2025-06-01",
        amountCents: 85_000_00,
        commissionBasisPoints: null,
        notes: null,
        documentId: null,
        discussionId: null,
      },
    ];

    expect(getCurrentCompensationChange(changes, "2025-05-31")?.id).toBe("1");
    expect(getCurrentCompensationChange(changes, "2025-06-01")?.id).toBe("2");
  });

  it("derives comparable salary deltas only within the same type", () => {
    const enriched = enrichCompensationChanges(
      [
        {
          id: "salary-1",
          employmentId: "emp",
          type: "hourly_rate",
          currency: "CAD",
          effectiveDate: "2024-01-01",
          amountCents: 4_500,
          commissionBasisPoints: null,
          notes: null,
          documentId: null,
          discussionId: null,
        },
        {
          id: "salary-2",
          employmentId: "emp",
          type: "annual_salary",
          currency: "CAD",
          effectiveDate: "2025-01-01",
          amountCents: 90_000_00,
          commissionBasisPoints: null,
          notes: null,
          documentId: null,
          discussionId: null,
        },
        {
          id: "salary-3",
          employmentId: "emp",
          type: "annual_salary",
          currency: "CAD",
          effectiveDate: "2026-01-01",
          amountCents: 95_000_00,
          commissionBasisPoints: null,
          notes: null,
          documentId: null,
          discussionId: null,
        },
      ],
      {
        documentTitleById: new Map(),
        discussionTitleById: new Map(),
      },
    );

    const hourlyChange = enriched.find((change) => change.id === "salary-1");
    const firstSalary = enriched.find((change) => change.id === "salary-2");
    const secondSalary = enriched.find((change) => change.id === "salary-3");

    expect(hourlyChange?.delta).toBeNull();
    expect(firstSalary?.delta).toBeNull();
    expect(secondSalary?.delta?.amountChangeCents).toBe(5_000_00);
    expect(secondSalary?.delta?.percentChange).toBeCloseTo(5.555, 2);
    expect(getCompensationDeltaDisplay(secondSalary!)?.label).toContain("5,000");
    expect(getCompensationDeltaDisplay(secondSalary!)?.direction).toBe("increase");
  });

  it("formats salary, hourly, and commission rates", () => {
    expect(
      formatCompensationRate({
        id: "1",
        employmentId: "emp",
        type: "annual_salary",
        currency: "CAD",
        effectiveDate: "2025-01-01",
        amountCents: 85_000_00,
        commissionBasisPoints: null,
        notes: null,
        documentId: null,
        discussionId: null,
      }),
    ).toContain("/year");

    expect(
      formatCompensationRate({
        id: "2",
        employmentId: "emp",
        type: "hourly_rate",
        currency: "CAD",
        effectiveDate: "2025-01-01",
        amountCents: 4_500,
        commissionBasisPoints: null,
        notes: null,
        documentId: null,
        discussionId: null,
      }),
    ).toContain("/hour");

    expect(
      formatCompensationRate({
        id: "3",
        employmentId: "emp",
        type: "commission",
        currency: "CAD",
        effectiveDate: "2025-01-01",
        amountCents: null,
        commissionBasisPoints: 6050,
        notes: null,
        documentId: null,
        discussionId: null,
      }),
    ).toBe("60.5% commission");
  });
});
