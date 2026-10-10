import { describe, expect, it } from "vitest";

import { isAppError } from "@yourtoolshq/server/errors";

import type {
  PositionInput,
  SaveSnapshotCommand,
  TotalInput,
} from "~/modules/investment-statements/domain/snapshot-dto";
import {
  assertReviewReady,
  normalizeSaveCommand,
} from "~/modules/investment-statements/domain/validate-snapshot";

const emptyTotal = (): TotalInput => ({
  currency: "CAD",
  scope: "account_total",
  closingValue: "100",
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
});

const basePosition = (): PositionInput => ({
  instrumentId: "inst-1",
  lineKind: "investment",
  sourceLabel: "Sample",
  sourceIdentifier: null,
  sourceSeries: null,
  valueCurrency: "CAD",
  marketValue: "100",
  quantity: "1",
  unitPrice: null,
  unitPriceCurrency: null,
  bookCost: null,
  bookCostCurrency: null,
  sourcePage: null,
  sourceNote: null,
});

const baseCommand = (): SaveSnapshotCommand => ({
  documentId: "doc-1",
  expectedRevision: null,
  valuationDate: "2026-03-31",
  coverageStart: null,
  coverageEnd: null,
  summaryCoverage: "partial",
  holdingsCoverage: "partial",
  notes: null,
  totals: [emptyTotal()],
  positions: [basePosition()],
});

describe("assertReviewReady", () => {
  it("allows negative amounts in normalized drafts", () => {
    const command = normalizeSaveCommand({
      ...baseCommand(),
      positions: [{ ...basePosition(), quantity: "-1" }],
    });
    expect(command.positions[0]?.quantity).toBe("-1");
  });

  it("rejects negative holdings and inconsistent currency pairs at review", () => {
    const totals = [emptyTotal()];
    const valuationDate = "2026-03-31";

    try {
      assertReviewReady(
        totals,
        [{ ...basePosition(), quantity: "-1" }],
        valuationDate,
      );
      throw new Error("Expected negative quantity rejection");
    } catch (error) {
      expect(isAppError(error) && error.code).toBe("invalid_input");
    }

    try {
      assertReviewReady(
        totals,
        [
          {
            ...basePosition(),
            unitPrice: "10",
            unitPriceCurrency: null,
          },
        ],
        valuationDate,
      );
      throw new Error("Expected unit price currency rejection");
    } catch (error) {
      expect(isAppError(error) && error.code).toBe("invalid_input");
    }
  });
});
