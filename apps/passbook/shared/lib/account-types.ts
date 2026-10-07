export const accountTypes = [
  "chequing",
  "savings",
  "credit_card",
  "line_of_credit",
  "tfsa",
  "rrsp",
  "fhsa",
  "investment",
  "mortgage",
  "loan",
  "financing",
  "other",
] as const;

export type AccountType = (typeof accountTypes)[number];

export const accountTypeLabels = {
  chequing: "Chequing",
  savings: "Savings",
  credit_card: "Credit card",
  line_of_credit: "Line of credit",
  tfsa: "TFSA",
  rrsp: "RRSP",
  fhsa: "FHSA",
  investment: "Investment",
  mortgage: "Mortgage",
  loan: "Loan",
  financing: "Financing",
  other: "Other",
} satisfies Record<AccountType, string>;
