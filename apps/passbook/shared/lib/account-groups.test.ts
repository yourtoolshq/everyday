import { describe, expect, it } from "vitest";

import { groupAccounts } from "./account-groups";

const alex = { id: "a", displayName: "Alex" };
const blair = { id: "b", displayName: "Blair" };
const accounts = [
  {
    id: "1",
    displayName: "Savings",
    institutionId: "bank",
    institutionName: "Example Bank",
    owners: [blair, alex],
  },
  {
    id: "2",
    displayName: "Chequing",
    institutionId: "bank",
    institutionName: "Example Bank",
    owners: [alex, blair],
  },
  {
    id: "3",
    displayName: "Savings",
    institutionId: "other",
    institutionName: "Example Bank",
    owners: [alex],
  },
  {
    id: "4",
    displayName: "Legacy",
    institutionId: "credit",
    institutionName: "Credit Union",
    owners: [],
  },
];

describe("groupAccounts", () => {
  it("groups by institution identity, orders accounts, and preserves the input", () => {
    const before = structuredClone(accounts);
    expect(
      groupAccounts(accounts, "institution").map((group) => [
        group.key,
        group.accounts.map((account) => account.id),
      ]),
    ).toEqual([
      ["credit", ["4"]],
      ["bank", ["2", "1"]],
      ["other", ["3"]],
    ]);
    expect(accounts).toEqual(before);
  });

  it("keeps joint accounts together exactly once regardless of owner order", () => {
    expect(
      groupAccounts(accounts, "owners").map((group) => [
        group.label,
        group.accounts.map((account) => account.id),
      ]),
    ).toEqual([
      ["Alex", ["3"]],
      ["Alex + Blair", ["2", "1"]],
      ["Unassigned", ["4"]],
    ]);
  });

  it("returns no groups for an empty inventory", () => {
    expect(groupAccounts([], "institution")).toEqual([]);
    expect(groupAccounts([], "owners")).toEqual([]);
  });
});
