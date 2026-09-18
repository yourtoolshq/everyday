import { describe, expect, it } from "vitest";

import { deriveExpectedPeriodsForYear } from "~/lib/expected-periods";
import {
  buildMissingStatements,
  buildYearCompletenessSummary,
  deriveStatementCompleteness,
} from "~/lib/statement-completeness";

const asOf = new Date("2026-09-17");

const accounts = [
  {
    id: "account-1",
    displayName: "Momentum Visa",
    institutionName: "Example Bank",
    openedDate: "2025-06-01",
    closedDate: null,
    status: "active" as const,
    statementFrequency: "monthly" as const,
  },
  {
    id: "account-2",
    displayName: "Savings",
    institutionName: "Example Bank",
    openedDate: "2026-01-01",
    closedDate: null,
    status: "active" as const,
    statementFrequency: "monthly" as const,
  },
];

describe("deriveStatementCompleteness", () => {
  const lifecycle = {
    openedDate: "2026-01-01",
    closedDate: null,
    status: "active" as const,
  };
  const periods = deriveExpectedPeriodsForYear(lifecycle, "monthly", 2026, asOf);

  it("maps timing and uploads to completeness states", () => {
    expect(deriveStatementCompleteness(periods[0]!, true)).toBe("complete");
    expect(deriveStatementCompleteness(periods[2]!, false)).toBe("missing");
    expect(deriveStatementCompleteness(periods[8]!, false)).toBe("waiting");
    expect(deriveStatementCompleteness(periods[9]!, false)).toBe("future");
  });

  it("marks missing periods as not applicable when an exception exists", () => {
    expect(deriveStatementCompleteness(periods[2]!, false, true)).toBe("not_applicable");
  });

  it("prefers uploaded statements over exceptions", () => {
    expect(deriveStatementCompleteness(periods[2]!, true, true)).toBe("complete");
  });

  it("ignores exceptions on waiting or future periods", () => {
    expect(deriveStatementCompleteness(periods[8]!, false, true)).toBe("waiting");
    expect(deriveStatementCompleteness(periods[9]!, false, true)).toBe("future");
  });
});

describe("buildYearCompletenessSummary", () => {
  it("counts complete, missing, and waiting statements for the year", () => {
    const summary = buildYearCompletenessSummary(
      accounts,
      {
        "account-1": {
          "2026-01": "doc-1",
          "2026-02": "doc-2",
          "2026-03": "doc-3",
          "2026-04": "doc-4",
          "2026-05": "doc-5",
          "2026-06": "doc-6",
          "2026-07": "doc-7",
          "2026-08": "doc-8",
        },
        "account-2": {
          "2026-01": "doc-9",
          "2026-02": "doc-10",
        },
      },
      2026,
      {},
      asOf,
    );

    expect(summary.expectedCount).toBe(18);
    expect(summary.completeCount).toBe(10);
    expect(summary.missingCount).toBe(6);
    expect(summary.waitingCount).toBe(2);
    expect(summary.notApplicableCount).toBe(0);
  });

  it("counts not applicable periods toward expected totals", () => {
    const summary = buildYearCompletenessSummary(
      accounts,
      {
        "account-1": {
          "2026-01": "doc-1",
          "2026-02": "doc-2",
          "2026-04": "doc-4",
        },
      },
      2026,
      {
        "account-1": {
          "2026-03": true,
          "2026-07": true,
        },
      },
      asOf,
    );

    expect(summary.notApplicableCount).toBe(2);
    expect(
      summary.completeCount +
        summary.notApplicableCount +
        summary.missingCount +
        summary.waitingCount,
    ).toBe(summary.expectedCount);
  });
});

describe("buildMissingStatements", () => {
  it("returns missing statements across accounts and years", () => {
    const missing = buildMissingStatements(
      accounts,
      {
        "account-1": {
          "2026-01": "doc-1",
          "2026-02": "doc-2",
          "2026-04": "doc-4",
        },
      },
      {},
      asOf,
    );

    expect(missing.some((item) => item.periodKey === "2026-03")).toBe(true);
    expect(missing.some((item) => item.periodKey === "2026-07")).toBe(true);
    expect(missing.some((item) => item.periodKey === "2026-09")).toBe(false);
    expect(missing.some((item) => item.periodKey === "2026-10")).toBe(false);
  });

  it("excludes periods marked not applicable", () => {
    const missing = buildMissingStatements(
      accounts,
      {
        "account-1": {
          "2026-01": "doc-1",
          "2026-02": "doc-2",
          "2026-04": "doc-4",
        },
      },
      {
        "account-1": {
          "2026-03": true,
        },
      },
      asOf,
    );

    expect(
      missing.some((item) => item.accountId === "account-1" && item.periodKey === "2026-03"),
    ).toBe(false);
    expect(
      missing.some((item) => item.accountId === "account-1" && item.periodKey === "2026-07"),
    ).toBe(true);
  });
});
