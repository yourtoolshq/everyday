export function groupInstitutionAccounts<
  T extends {
    owners: { id: string; displayName: string }[];
  },
>(accounts: T[]) {
  const groups = new Map<
    string,
    { key: string; label: string; accounts: T[] }
  >();
  for (const account of accounts) {
    const owners = [...account.owners].sort((a, b) => a.id.localeCompare(b.id));
    const key = owners.length
      ? owners.map((owner) => owner.id).join(":")
      : "unassigned";
    const label = owners.length
      ? owners
          .map((owner) => owner.displayName)
          .sort((a, b) => a.localeCompare(b))
          .join(" + ")
      : "Unassigned";
    const group = groups.get(key) ?? { key, label, accounts: [] };
    group.accounts.push(account);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.key === "unassigned") return 1;
    if (b.key === "unassigned") return -1;
    const aJoint = a.key.includes(":");
    const bJoint = b.key.includes(":");
    if (aJoint !== bJoint) return aJoint ? 1 : -1;
    return a.label.localeCompare(b.label);
  });
}
