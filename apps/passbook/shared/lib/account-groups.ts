import { groupInstitutionAccounts } from "~/lib/institution-account-groups";

export function groupAccounts<
  T extends {
    id: string;
    displayName: string;
    institutionId: string;
    institutionName: string;
    owners: { id: string; displayName: string }[];
  },
>(accounts: T[], grouping: "institution" | "owners") {
  const sorted = [...accounts].sort(
    (a, b) =>
      a.institutionName.localeCompare(b.institutionName) ||
      a.displayName.localeCompare(b.displayName) ||
      a.id.localeCompare(b.id),
  );
  if (grouping === "owners") return groupInstitutionAccounts(sorted);

  const groups = new Map<
    string,
    { key: string; label: string; accounts: T[] }
  >();
  for (const account of sorted) {
    const group = groups.get(account.institutionId) ?? {
      key: account.institutionId,
      label: account.institutionName,
      accounts: [],
    };
    group.accounts.push(account);
    groups.set(group.key, group);
  }
  return [...groups.values()];
}
