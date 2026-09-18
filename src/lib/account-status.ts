export const accountStatuses = ["active", "closed"] as const;

export type AccountStatus = (typeof accountStatuses)[number];

export const accountStatusLabels = {
  active: "Active",
  closed: "Closed",
} satisfies Record<AccountStatus, string>;
