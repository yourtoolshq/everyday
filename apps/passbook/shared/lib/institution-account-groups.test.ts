import { describe, expect, it } from "vitest";

import { groupInstitutionAccounts } from "./institution-account-groups";

describe("groupInstitutionAccounts", () => {
  it("places each joint account once and keeps owner combinations distinct", () => {
    const alex = { id: "a", displayName: "Alex" };
    const blair = { id: "b", displayName: "Blair" };
    const casey = { id: "c", displayName: "Casey" };
    const groups = groupInstitutionAccounts([
      { name: "Joint one", owners: [blair, alex] },
      { name: "Joint two", owners: [alex, blair] },
      { name: "Alex", owners: [alex] },
      { name: "Other joint", owners: [alex, casey] },
      { name: "Legacy", owners: [] },
    ]);
    expect(
      groups.map((group) => [
        group.label,
        group.accounts.map((account) => account.name),
      ]),
    ).toEqual([
      ["Alex", ["Alex"]],
      ["Alex + Blair", ["Joint one", "Joint two"]],
      ["Alex + Casey", ["Other joint"]],
      ["Unassigned", ["Legacy"]],
    ]);
  });
});
