export const instrumentKinds = [
  "stock",
  "etf",
  "mutual_fund",
  "other",
] as const;
export type InstrumentKind = (typeof instrumentKinds)[number];

export const identifierKinds = [
  "ticker",
  "fund_code",
  "isin",
  "cusip",
] as const;
export type IdentifierKind = (typeof identifierKinds)[number];
