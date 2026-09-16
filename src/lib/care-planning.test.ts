import { describe, expect, it } from "vitest";

import {
  careCadences,
  careCategories,
  careItemFieldsSchema,
  careItemSortKey,
  careSources,
} from "~/lib/care-planning";

describe("care planning values", () => {
  it("keeps the Phase 1 option lists stable", () => {
    expect(careCategories).toHaveLength(8);
    expect(careCadences).toHaveLength(5);
    expect(careSources).toHaveLength(6);
  });

  it("validates conditional cadence and timing details", () => {
    const base = {
      personId: crypto.randomUUID(),
      title: "Routine care",
      category: "primary_care" as const,
      targetVisitCount: 1,
      cadence: "one_time" as const,
      intervalCount: null,
      intervalUnit: null,
      timingKind: "none" as const,
      targetDate: null,
      dateMeaning: null,
      targetMonth: null,
      targetSeason: null,
      source: "personal_decision" as const,
      sourceDetail: null,
      notes: null,
    };

    expect(careItemFieldsSchema.safeParse(base).success).toBe(true);
    expect(
      careItemFieldsSchema.safeParse({
        ...base,
        cadence: "recurring_interval",
      }).success,
    ).toBe(false);
    expect(
      careItemFieldsSchema.safeParse({
        ...base,
        timingKind: "date",
        targetDate: "2027-03-01",
        dateMeaning: "not_before",
      }).success,
    ).toBe(true);
  });

  it("sorts structured timing chronologically and leaves untimed care last", () => {
    const items = [
      { timingKind: "none" as const, targetDate: null, targetMonth: null, targetSeason: null },
      { timingKind: "date" as const, targetDate: "2027-09-15", targetMonth: null, targetSeason: null },
      { timingKind: "season" as const, targetDate: null, targetMonth: null, targetSeason: "spring" as const },
      { timingKind: "month" as const, targetDate: null, targetMonth: 6, targetSeason: null },
    ];

    expect(items.sort((a, b) => careItemSortKey(a) - careItemSortKey(b))).toEqual([
      items.find((item) => item.targetSeason === "spring"),
      items.find((item) => item.targetMonth === 6),
      items.find((item) => item.targetDate === "2027-09-15"),
      items.find((item) => item.timingKind === "none"),
    ]);
  });
});
