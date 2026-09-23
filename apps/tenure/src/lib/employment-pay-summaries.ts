export type PaycheckForSummary = {
  payDate: string;
  grossPayCents: number;
  netPayCents: number;
};

export type PaySummary = {
  grossCents: number;
  netCents: number;
  paycheckCount: number;
};

export function currentCalendarYear(asOfDate: Date = new Date()): number {
  return asOfDate.getFullYear();
}

export function paycheckInYear(payDate: string, year: number): boolean {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(payDate);
  return match?.[1] === String(year);
}

export function sumPaychecks(
  paychecks: ReadonlyArray<PaycheckForSummary>,
  year?: number,
): PaySummary {
  const filtered =
    year === undefined
      ? paychecks
      : paychecks.filter((paycheck) => paycheckInYear(paycheck.payDate, year));

  return {
    grossCents: filtered.reduce(
      (sum, paycheck) => sum + paycheck.grossPayCents,
      0,
    ),
    netCents: filtered.reduce((sum, paycheck) => sum + paycheck.netPayCents, 0),
    paycheckCount: filtered.length,
  };
}

export type HouseholdPaySummary = {
  year: number;
  lifetime: PaySummary;
  thisYear: PaySummary;
};

export function buildHouseholdPaySummary(
  paychecks: ReadonlyArray<PaycheckForSummary>,
  asOfDate: Date = new Date(),
): HouseholdPaySummary {
  const year = currentCalendarYear(asOfDate);
  return {
    year,
    lifetime: sumPaychecks(paychecks),
    thisYear: sumPaychecks(paychecks, year),
  };
}
