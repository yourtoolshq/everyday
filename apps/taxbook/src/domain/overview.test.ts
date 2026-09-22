import { describe, expect, it } from "vitest";

import { buildOverview, type OverviewItem } from "./overview";

const base: OverviewItem = {
  id: 1,
  name: "Fictional income",
  type: "income",
  status: "planned",
  expectedAmountCents: null,
  actualAmountCents: null,
  updatedAt: new Date("2026-01-01"),
};

describe("buildOverview", () => {
  it("aggregates each type independently", () => {
    const overview = buildOverview([
      { ...base, expectedAmountCents: 10000, actualAmountCents: 4000 },
      {
        ...base,
        id: 2,
        type: "deduction_contribution",
        expectedAmountCents: 2500,
        actualAmountCents: 500,
      },
    ]);
    expect(overview.amounts.income.expectedAmountCents).toBe(10000);
    expect(overview.amounts.deduction_contribution.actualAmountCents).toBe(500);
    expect(overview.amounts.other.expectedAmountCents).toBe(0);
  });

  it("counts progress and flags unfinished or missing actual amounts", () => {
    const overview = buildOverview([
      base,
      { ...base, id: 2, status: "complete", expectedAmountCents: 1000 },
      { ...base, id: 3, status: "complete", actualAmountCents: 1000 },
    ]);
    expect(overview.statuses).toEqual({
      planned: 1,
      in_progress: 0,
      complete: 2,
    });
    expect(overview.attention.map((item) => item.id)).toEqual([1, 2]);
  });
});
