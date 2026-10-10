import type Decimal from "decimal.js";

import type { SnapshotDto } from "~/modules/investment-statements/domain/snapshot-dto";
import {
  decimalEquals,
  parseDecimalAmount,
} from "~/modules/investment-statements/domain/decimal-money";

export type SnapshotComparisonObservation =
  | { kind: "quantity_increased"; instrumentId: string; label: string }
  | { kind: "quantity_decreased"; instrumentId: string; label: string }
  | { kind: "value_changed"; instrumentId: string; label: string }
  | { kind: "holding_new"; instrumentId: string; label: string }
  | { kind: "holding_missing"; instrumentId: string; label: string }
  | { kind: "coverage_incomplete"; message: string }
  | { kind: "not_comparable"; message: string };

export interface SnapshotPairComparison {
  earlierDate: string;
  laterDate: string;
  observations: SnapshotComparisonObservation[];
}

interface InstrumentAggregate {
  label: string;
  quantity: Decimal | null;
  marketByCurrency: Map<string, Decimal | null>;
}

function closingTotalForCurrency(
  snapshot: SnapshotDto,
  currency: string,
): string | null {
  const row = snapshot.totals.find(
    (total) =>
      total.scope === "account_total" &&
      total.currency === currency &&
      total.closingValue,
  );
  return row?.closingValue ?? null;
}

export function compareAccountClosingValues(
  earlier: SnapshotDto,
  later: SnapshotDto,
  currency: string,
): { comparable: boolean; change: string | null; message: string } {
  const left = closingTotalForCurrency(earlier, currency);
  const right = closingTotalForCurrency(later, currency);
  if (!left || !right) {
    return {
      comparable: false,
      change: null,
      message: "Both snapshots need a closing account total in this currency.",
    };
  }
  const change = parseDecimalAmount(right)!.minus(parseDecimalAmount(left)!);
  return {
    comparable: true,
    change: change.toFixed(),
    message: "Change in reported closing account value between the two dates.",
  };
}

function mergeMarketValue(
  map: Map<string, Decimal | null>,
  currency: string,
  marketValue: string | null,
): void {
  if (!marketValue?.trim()) {
    map.set(currency, null);
    return;
  }
  const parsed = parseDecimalAmount(marketValue);
  const current = map.get(currency);
  if (current === null) {
    return;
  }
  if (current === undefined) {
    map.set(currency, parsed);
    return;
  }
  if (parsed) {
    map.set(currency, current.plus(parsed));
  }
}

function aggregateHoldingsByInstrument(snapshot: SnapshotDto) {
  const map = new Map<string, InstrumentAggregate>();
  for (const position of snapshot.positions) {
    if (position.lineKind !== "investment" || !position.instrumentId) continue;
    const instrumentId = position.instrumentId;
    const current = map.get(instrumentId);
    const label = position.sourceLabel;
    const rowQuantity = position.quantity?.trim()
      ? parseDecimalAmount(position.quantity)
      : null;

    if (!current) {
      const marketByCurrency = new Map<string, Decimal | null>();
      mergeMarketValue(
        marketByCurrency,
        position.valueCurrency,
        position.marketValue,
      );
      map.set(instrumentId, {
        label,
        quantity: rowQuantity,
        marketByCurrency,
      });
      continue;
    }

    if (!position.quantity?.trim()) {
      current.quantity = null;
    } else if (current.quantity !== null && rowQuantity) {
      current.quantity = current.quantity.plus(rowQuantity);
    }

    mergeMarketValue(
      current.marketByCurrency,
      position.valueCurrency,
      position.marketValue,
    );
  }
  return map;
}

function holdingsCoverageComplete(snapshot: SnapshotDto): boolean {
  return snapshot.holdingsCoverage === "complete";
}

function marketValueChangedBetween(
  before: InstrumentAggregate,
  after: InstrumentAggregate,
): boolean {
  const currencies = new Set([
    ...before.marketByCurrency.keys(),
    ...after.marketByCurrency.keys(),
  ]);
  for (const currency of currencies) {
    const earlierValue = before.marketByCurrency.get(currency);
    const laterValue = after.marketByCurrency.get(currency);
    if (earlierValue === undefined && laterValue === undefined) {
      continue;
    }
    if (earlierValue === null || laterValue === null) {
      continue;
    }
    if (earlierValue === undefined || laterValue === undefined) {
      continue;
    }
    if (!decimalEquals(earlierValue.toFixed(), laterValue.toFixed())) {
      return true;
    }
  }
  return false;
}

export function compareSnapshotHoldings(
  earlier: SnapshotDto,
  later: SnapshotDto,
): SnapshotPairComparison {
  const observations: SnapshotComparisonObservation[] = [];
  const bothHoldingsComplete =
    holdingsCoverageComplete(earlier) && holdingsCoverageComplete(later);

  if (!bothHoldingsComplete) {
    observations.push({
      kind: "coverage_incomplete",
      message:
        "Holdings comparisons are limited until both snapshots have complete holdings coverage.",
    });
  }

  const earlierMap = aggregateHoldingsByInstrument(earlier);
  const laterMap = aggregateHoldingsByInstrument(later);
  const instrumentIds = new Set([...earlierMap.keys(), ...laterMap.keys()]);

  for (const instrumentId of instrumentIds) {
    const before = earlierMap.get(instrumentId);
    const after = laterMap.get(instrumentId);
    const label = after?.label ?? before?.label ?? "Holding";

    if (before && !after) {
      if (bothHoldingsComplete) {
        observations.push({
          kind: "holding_missing",
          instrumentId,
          label,
        });
      }
      continue;
    }
    if (!before && after) {
      if (bothHoldingsComplete) {
        observations.push({ kind: "holding_new", instrumentId, label });
      }
      continue;
    }
    if (!before || !after) continue;

    const beforeQty = before.quantity;
    const afterQty = after.quantity;
    if (beforeQty && afterQty) {
      if (afterQty.gt(beforeQty)) {
        observations.push({
          kind: "quantity_increased",
          instrumentId,
          label,
        });
      } else if (afterQty.lt(beforeQty)) {
        observations.push({
          kind: "quantity_decreased",
          instrumentId,
          label,
        });
      } else if (marketValueChangedBetween(before, after)) {
        observations.push({ kind: "value_changed", instrumentId, label });
      }
    }
  }

  return {
    earlierDate: earlier.valuationDate,
    laterDate: later.valuationDate,
    observations,
  };
}

export function isGraphEligible(snapshot: SnapshotDto): boolean {
  return (
    snapshot.reviewStatus === "reviewed" || snapshot.reviewStatus === "draft"
  );
}

export function isComparisonEligible(snapshot: SnapshotDto): boolean {
  return (
    snapshot.reviewStatus === "reviewed" &&
    snapshot.summaryCoverage !== "not_entered"
  );
}
