export const statementFrequencies = ["monthly", "quarterly", "annually", "none"] as const;

export type StatementFrequency = (typeof statementFrequencies)[number];

export const defaultStatementFrequency: StatementFrequency = "monthly";

export const statementFrequencyLabels = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
  none: "None",
} satisfies Record<StatementFrequency, string>;
