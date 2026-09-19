export const payFrequencies = [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "irregular",
] as const;

export type PayFrequency = (typeof payFrequencies)[number];

export const payFrequencyLabels: Record<PayFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  semimonthly: "Twice a month",
  monthly: "Monthly",
  irregular: "Irregular",
};
