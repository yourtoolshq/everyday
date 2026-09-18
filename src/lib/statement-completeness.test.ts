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
      asOf,
    );

    expect(summary.expectedCount).toBe(18);
    expect(summary.completeCount).toBe(10);
    expect(summary.missingCount).toBe(6);
    expect(summary.waitingCount).toBe(2);
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
      asOf,
    );

    expect(missing.some((item) => item.periodKey === "2026-03")).toBe(true);
    expect(missing.some((item) => item.periodKey === "2026-07")).toBe(true);
    expect(missing.some((item) => item.periodKey === "2026-09")).toBe(false);
    expect(missing.some((item) => item.periodKey === "2026-10")).toBe(false);
  });
});
