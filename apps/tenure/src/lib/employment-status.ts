export const employmentStatuses = ["current", "former"] as const;

export type EmploymentStatus = (typeof employmentStatuses)[number];

export const employmentStatusLabels = {
  current: "Current",
  former: "Former",
} satisfies Record<EmploymentStatus, string>;
