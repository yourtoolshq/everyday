import { expect, test } from "vitest";

import { leaseFieldsSchema, leaseStatus, leaseSummary } from "./leases";

test("lease status uses inclusive calendar boundaries and explicit month-to-month terms", () => {
  const fixed = {
    termType: "fixed_term" as const,
    startsOn: "2026-10-01",
    endsOn: "2027-09-30",
  };
  expect(leaseStatus(fixed, "2026-09-30")).toBe("Upcoming");
  expect(leaseStatus(fixed, "2026-10-01")).toBe("Active");
  expect(leaseStatus(fixed, "2027-09-30")).toBe("Active");
  expect(leaseStatus(fixed, "2027-10-01")).toBe("Ended");
  expect(leaseStatus({ ...fixed, endsOn: null }, "2026-10-12")).toBe(
    "Dates incomplete",
  );
  expect(leaseStatus({ ...fixed, startsOn: null }, "2026-10-12")).toBe(
    "Dates incomplete",
  );
  expect(
    leaseStatus(
      { ...fixed, termType: "month_to_month", endsOn: null },
      "2026-10-12",
    ),
  ).toBe("Active");
  expect(leaseSummary([fixed, fixed], "2026-10-12")).toContain("Overlapping");
  expect(leaseSummary([fixed], "2026-10-12")).toBe("One active lease recorded");
  expect(leaseSummary([fixed], "2027-10-01")).toBe("No active lease recorded");
});
test("rejects invalid and reversed dates while allowing incomplete records", () => {
  const input = {
    propertyId: crypto.randomUUID(),
    title: "Renewal",
    termType: "fixed_term",
    startsOn: "2026-10-01",
  };
  expect(leaseFieldsSchema.safeParse(input).success).toBe(true);
  expect(
    leaseFieldsSchema.safeParse({ ...input, endsOn: "2026-09-30" }).success,
  ).toBe(false);
  expect(
    leaseFieldsSchema.safeParse({ ...input, endsOn: "2027-02-29" }).success,
  ).toBe(false);
});
