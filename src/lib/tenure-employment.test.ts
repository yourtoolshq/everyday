import { describe, expect, it } from "vitest";

import {
  employmentOverlapsTaxYear,
  mapTenureEmploymentStatus,
  normalizePersonName,
  resolveTenurePersonId,
} from "./tenure-employment";

describe("tenure employment helpers", () => {
  it("detects overlap with a tax year", () => {
    expect(
      employmentOverlapsTaxYear(
        { status: "current", startDate: "2024-06-01", endDate: null },
        2025,
      ),
    ).toBe(true);
    expect(
      employmentOverlapsTaxYear(
        { status: "former", startDate: "2023-01-01", endDate: "2024-12-31" },
        2025,
      ),
    ).toBe(false);
  });

  it("maps former employment end dates inside the tax year", () => {
    expect(
      mapTenureEmploymentStatus(
        { status: "former", endDate: "2025-08-15" },
        2025,
      ),
    ).toEqual({ status: "ended", endDate: "2025-08-15" });
  });

  it("normalizes person names for matching", () => {
    expect(normalizePersonName(" Jane Doe ")).toBe("jane doe");
  });

  it("prefers a saved person mapping over name matching", () => {
    const people = [
      { id: 1, name: "Alex" },
      { id: 2, name: "Jordan" },
    ];

    expect(
      resolveTenurePersonId({
        tenurePersonId: "person-1",
        tenurePersonName: "Alexandra",
        householdPeople: people,
        personMappings: { "person-1": 2 },
      }),
    ).toEqual({ personId: 2, matchKind: "mapped" });
  });
});
