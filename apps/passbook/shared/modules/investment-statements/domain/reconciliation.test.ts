import { describe, expect, it } from "vitest";

import type {
  PositionInput,
  TotalInput,
} from "~/modules/investment-statements/domain/snapshot-dto";
import {
  crossCheckSummaryCash,
  reconcileHoldingsToTotal,
} from "~/modules/investment-statements/domain/reconciliation";

const totals = (rows: TotalInput[]) => rows;
const positions = (rows: PositionInput[]) => rows;

describe("holdings reconciliation", () => {
  it("counts cash once and warns when totals diverge", () => {
    const totalRows = totals([
      {
        currency: "CAD",
        scope: "account_total",
        closingValue: "1000.00",
        openingValue: null,
        cash: "100.00",
        bookCost: null,
        contributions: null,
        withdrawals: null,
        transfersIn: null,
        transfersOut: null,
        income: null,
        fees: null,
        reportedValueChange: null,
        sourcePage: null,
        sourceNote: null,
      },
    ]);
    const positionRows = positions([
      {
        instrumentId: null,
        lineKind: "investment",
        sourceLabel: "Sample ETF",
        sourceIdentifier: "SMP",
        sourceSeries: null,
        valueCurrency: "CAD",
        marketValue: "900.00",
        quantity: "10",
        unitPrice: "90",
        unitPriceCurrency: "CAD",
        bookCost: null,
        bookCostCurrency: null,
        sourcePage: null,
        sourceNote: null,
      },
      {
        instrumentId: null,
        lineKind: "cash",
        sourceLabel: "Cash",
        sourceIdentifier: null,
        sourceSeries: null,
        valueCurrency: "CAD",
        marketValue: "50.00",
        quantity: null,
        unitPrice: null,
        unitPriceCurrency: null,
        bookCost: null,
        bookCostCurrency: null,
        sourcePage: null,
        sourceNote: null,
      },
    ]);

    const reconciliation = reconcileHoldingsToTotal(
      totalRows,
      positionRows,
      "complete",
      "complete",
      "CAD",
    );
    expect(reconciliation.status).toBe("warning");

    const cashCheck = crossCheckSummaryCash(
      totalRows,
      positionRows,
      "complete",
      "complete",
    );
    expect(cashCheck.status).toBe("warning");
    expect(cashCheck.summaryCash).toBe("100");
    expect(cashCheck.cashPositionsSum).toBe("50");
  });

  it("refuses mixed-currency reconciliation", () => {
    const reconciliation = reconcileHoldingsToTotal(
      totals([
        {
          currency: "CAD",
          scope: "account_total",
          closingValue: "1000",
          openingValue: null,
          cash: null,
          bookCost: null,
          contributions: null,
          withdrawals: null,
          transfersIn: null,
          transfersOut: null,
          income: null,
          fees: null,
          reportedValueChange: null,
          sourcePage: null,
          sourceNote: null,
        },
      ]),
      positions([
        {
          instrumentId: null,
          lineKind: "investment",
          sourceLabel: "US listing",
          sourceIdentifier: null,
          sourceSeries: null,
          valueCurrency: "USD",
          marketValue: "100",
          quantity: null,
          unitPrice: null,
          unitPriceCurrency: null,
          bookCost: null,
          bookCostCurrency: null,
          sourcePage: null,
          sourceNote: null,
        },
      ]),
      "complete",
      "complete",
      "CAD",
    );
    expect(reconciliation.status).toBe("currency_mismatch");
  });

  it("returns partial coverage when summary is partial", () => {
    const reconciliation = reconcileHoldingsToTotal(
      totals([
        {
          currency: "CAD",
          scope: "account_total",
          closingValue: "1000",
          openingValue: null,
          cash: null,
          bookCost: null,
          contributions: null,
          withdrawals: null,
          transfersIn: null,
          transfersOut: null,
          income: null,
          fees: null,
          reportedValueChange: null,
          sourcePage: null,
          sourceNote: null,
        },
      ]),
      positions([]),
      "partial",
      "complete",
      "CAD",
    );
    expect(reconciliation.status).toBe("partial_coverage");
  });

  it("does not treat missing market values as zero in the sum", () => {
    const reconciliation = reconcileHoldingsToTotal(
      totals([
        {
          currency: "CAD",
          scope: "account_total",
          closingValue: "1000",
          openingValue: null,
          cash: null,
          bookCost: null,
          contributions: null,
          withdrawals: null,
          transfersIn: null,
          transfersOut: null,
          income: null,
          fees: null,
          reportedValueChange: null,
          sourcePage: null,
          sourceNote: null,
        },
      ]),
      positions([
        {
          instrumentId: null,
          lineKind: "investment",
          sourceLabel: "With value",
          sourceIdentifier: null,
          sourceSeries: null,
          valueCurrency: "CAD",
          marketValue: "600",
          quantity: null,
          unitPrice: null,
          unitPriceCurrency: null,
          bookCost: null,
          bookCostCurrency: null,
          sourcePage: null,
          sourceNote: null,
        },
        {
          instrumentId: null,
          lineKind: "cash",
          sourceLabel: "Cash",
          sourceIdentifier: null,
          sourceSeries: null,
          valueCurrency: "CAD",
          marketValue: null,
          quantity: null,
          unitPrice: null,
          unitPriceCurrency: null,
          bookCost: null,
          bookCostCurrency: null,
          sourcePage: null,
          sourceNote: null,
        },
      ]),
      "complete",
      "complete",
      "CAD",
    );
    expect(reconciliation.status).toBe("partial_coverage");
    expect(reconciliation.positionsSum).toBeNull();
  });
});
