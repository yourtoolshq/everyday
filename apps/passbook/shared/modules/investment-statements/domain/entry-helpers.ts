import type { PositionInput, SnapshotDto } from "./snapshot-dto";
import { parseDecimalAmount, subtractAmounts } from "./decimal-money";

export function suggestStatementDates(period: string | null) {
  const match = /^(\d{4})(?:-(\d{2})|-Q([1-4]))?$/.exec(period ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2]
    ? Number(match[2])
    : match[3]
      ? (Number(match[3]) - 1) * 3 + 1
      : 1;
  if (month < 1 || month > 12) return null;
  const months = match[2] ? 1 : match[3] ? 3 : 12;
  return {
    start: `${match[1]}-${String(month).padStart(2, "0")}-01`,
    end: new Date(Date.UTC(year, month - 1 + months, 0))
      .toISOString()
      .slice(0, 10),
  };
}

export function rememberedPositions(
  history: SnapshotDto[],
  before: string,
): PositionInput[] {
  const earlier = history
    .filter(
      (row) => row.reviewStatus === "reviewed" && row.valuationDate < before,
    )
    .sort((a, b) => a.valuationDate.localeCompare(b.valuationDate));
  const dates = new Set(earlier.map((row) => row.valuationDate));
  const active = new Map<string, PositionInput>();
  for (const date of dates) {
    const statements = earlier.filter((row) => row.valuationDate === date);
    if (statements.length !== 1) return [];
    const occurrences = new Map<string, number>();
    for (const row of statements[0]!.positions) {
      const identity = JSON.stringify([
        row.instrumentId ?? row.sourceLabel,
        row.sourceSeries,
        row.lineKind,
        row.valueCurrency,
      ]);
      const occurrence = occurrences.get(identity) ?? 0;
      occurrences.set(identity, occurrence + 1);
      const key = `${identity}:${occurrence}`;
      const zeroValue =
        row.marketValue != null &&
        parseDecimalAmount(row.marketValue)?.isZero();
      const zeroQuantity =
        row.quantity != null && parseDecimalAmount(row.quantity)?.isZero();
      if (zeroValue && (row.lineKind === "cash" || zeroQuantity))
        active.delete(key);
      else active.set(key, row);
    }
  }
  return [...active.values()].map((row) => ({
    ...row,
    marketValue: null,
    quantity: null,
    unitPrice: null,
    bookCost: null,
    sourcePage: null,
    sourceNote: null,
  }));
}

export function holdingDifference(row: PositionInput) {
  if ((row.bookCostCurrency ?? row.valueCurrency) !== row.valueCurrency)
    return null;
  try {
    return subtractAmounts(row.marketValue, row.bookCost);
  } catch {
    return null;
  }
}

export function suggestedMarketValue(row: PositionInput): string | null {
  if (!row.unitPriceCurrency || row.unitPriceCurrency !== row.valueCurrency)
    return null;
  try {
    const quantity = row.quantity ? parseDecimalAmount(row.quantity) : null;
    const price = row.unitPrice ? parseDecimalAmount(row.unitPrice) : null;
    if (!quantity || !price || quantity.isNegative() || price.isNegative())
      return null;
    return quantity.times(price).toDecimalPlaces(2).toFixed(2);
  } catch {
    return null;
  }
}

export function formatInvestmentAmount(
  value: string | null | undefined,
  currency?: string,
): string {
  if (value == null || !value.trim()) return "—";
  try {
    const decimal = parseDecimalAmount(value);
    if (!decimal) return "—";
    const [whole, fraction] = decimal.toFixed(2).split(".");
    return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}${currency ? ` ${currency}` : ""}`;
  } catch {
    return "—";
  }
}

/** Restricted decimal expression entry; never evaluates JavaScript or binary money. */
export function normalizeInvestmentEntry(
  value: string,
  precision = 2,
): { ok: true; value: string } | { ok: false; message: string } {
  const source = value.replace(/,/g, "").replace(/\s/g, "");
  if (!source) return { ok: true, value: "" };
  try {
    const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[+*/-]/g);
    if (!tokens || tokens.join("") !== source) throw new Error();
    let index = 0;
    function factor(): NonNullable<ReturnType<typeof parseDecimalAmount>> {
      let sign = 1;
      if (tokens![index] === "-") {
        sign = -1;
        index++;
      } else if (tokens![index] === "+") index++;
      const token = tokens![index++];
      if (!token || /[+*/-]/.test(token)) throw new Error();
      return parseDecimalAmount(
        token.endsWith(".") ? token.slice(0, -1) : token,
      )!.times(sign);
    }
    function term(): NonNullable<ReturnType<typeof parseDecimalAmount>> {
      let result = factor();
      while (tokens![index] === "*" || tokens![index] === "/") {
        const operator = tokens![index++];
        const right = factor();
        if (operator === "/" && right.isZero())
          throw new Error("Cannot divide by zero.");
        result = operator === "*" ? result.times(right) : result.div(right);
      }
      return result;
    }
    let result = term();
    while (index < tokens.length) {
      const operator = tokens[index++];
      if (operator !== "+" && operator !== "-") throw new Error();
      const right = term();
      result = operator === "+" ? result.plus(right) : result.minus(right);
    }
    const normalized = result.toDecimalPlaces(precision).toFixed();
    parseDecimalAmount(normalized);
    return { ok: true, value: normalized };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message === "Cannot divide by zero."
          ? error.message
          : "Enter a number or a simple + − * / expression.",
    };
  }
}

export function calculateValueChange(
  later: string | null,
  earlier: string | null,
) {
  try {
    const change = subtractAmounts(later, earlier);
    if (!change) return null;
    const base = earlier ? parseDecimalAmount(earlier) : null;
    return {
      amount: change.toFixed(),
      direction: change.isZero() ? "flat" : change.isPositive() ? "up" : "down",
      percentage:
        base && !base.isZero()
          ? change.div(base.abs()).times(100).toFixed(1)
          : null,
    };
  } catch {
    return null;
  }
}

export function enteredDistribution(snapshot: SnapshotDto, currency: string) {
  const positions = snapshot.positions.filter(
    (row) => row.valueCurrency === currency,
  );
  const total = snapshot.totals.find(
    (row) => row.scope === "account_total" && row.currency === currency,
  );
  const entries = positions
    .filter(
      (row) =>
        row.marketValue != null &&
        parseDecimalAmount(row.marketValue)?.isPositive(),
    )
    .map((row) => ({ label: row.sourceLabel, value: row.marketValue! }));
  if (
    total?.cash &&
    parseDecimalAmount(total.cash)?.isPositive() &&
    !positions.some((row) => row.lineKind === "cash")
  )
    entries.push({ label: "Cash", value: total.cash });
  const sum = entries.reduce(
    (result, row) => result.plus(parseDecimalAmount(row.value)!),
    parseDecimalAmount("0")!,
  );
  return {
    entries: entries.map((row) => ({
      ...row,
      share: sum.isZero()
        ? null
        : parseDecimalAmount(row.value)!.div(sum).times(100).toFixed(1),
    })),
    missingValues: positions.some((row) => row.marketValue == null),
  };
}
