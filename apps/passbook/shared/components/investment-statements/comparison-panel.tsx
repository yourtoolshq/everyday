"use client";

import { useMemo } from "react";

import { Label } from "@yourtoolshq/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@yourtoolshq/ui/select";

import type { SnapshotDto } from "~/modules/investment-statements/domain/snapshot-dto";
import { displayAmount } from "~/components/investment-statements/investment-form-state";
import { observationLabel } from "~/components/investment-statements/investment-labels";
import { formatDateLabel } from "~/lib/format-date";
import {
  compareAccountClosingValues,
  compareSnapshotHoldings,
  isComparisonEligible,
} from "~/modules/investment-statements/domain/comparison";

export function ComparisonPanel({
  snapshots,
  earlierDocumentId,
  laterDocumentId,
  onEarlierChange,
  onLaterChange,
}: {
  snapshots: SnapshotDto[];
  earlierDocumentId: string | null;
  laterDocumentId: string | null;
  onEarlierChange: (documentId: string) => void;
  onLaterChange: (documentId: string) => void;
}) {
  const eligible = snapshots.filter(isComparisonEligible);
  const earlier = eligible.find((row) => row.documentId === earlierDocumentId);
  const later = eligible.find((row) => row.documentId === laterDocumentId);

  const sameSelection =
    earlierDocumentId != null &&
    laterDocumentId != null &&
    earlierDocumentId === laterDocumentId;

  const chronologicalInvalid =
    !sameSelection &&
    earlier != null &&
    later != null &&
    earlier.valuationDate > later.valuationDate;

  const comparison = useMemo(() => {
    if (!earlier || !later || sameSelection || chronologicalInvalid) {
      return null;
    }
    return compareSnapshotHoldings(earlier, later);
  }, [earlier, later, sameSelection, chronologicalInvalid]);

  const closingCurrency =
    earlier?.totals.find((row) => row.scope === "account_total")?.currency ??
    later?.totals.find((row) => row.scope === "account_total")?.currency ??
    "CAD";

  const closingChange = (() => {
    if (!earlier || !later || sameSelection || chronologicalInvalid) {
      return null;
    }
    return compareAccountClosingValues(earlier, later, closingCurrency);
  })();

  if (eligible.length < 2) {
    return (
      <p className="text-muted-foreground text-sm">
        Review at least two statements with entered summary facts to compare
        observations.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="compare-earlier">Earlier observation</Label>
          <Select
            value={earlierDocumentId ?? ""}
            onValueChange={(value) => {
              if (value === laterDocumentId) return;
              onEarlierChange(value);
            }}
          >
            <SelectTrigger id="compare-earlier">
              <SelectValue placeholder="Choose statement" />
            </SelectTrigger>
            <SelectContent>
              {eligible.map((row) => (
                <SelectItem
                  key={row.documentId}
                  value={row.documentId}
                  disabled={row.documentId === laterDocumentId}
                >
                  {formatDateLabel(row.valuationDate)} · {row.documentTitle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="compare-later">Later observation</Label>
          <Select
            value={laterDocumentId ?? ""}
            onValueChange={(value) => {
              if (value === earlierDocumentId) return;
              onLaterChange(value);
            }}
          >
            <SelectTrigger id="compare-later">
              <SelectValue placeholder="Choose statement" />
            </SelectTrigger>
            <SelectContent>
              {eligible.map((row) => (
                <SelectItem
                  key={row.documentId}
                  value={row.documentId}
                  disabled={row.documentId === earlierDocumentId}
                >
                  {formatDateLabel(row.valuationDate)} · {row.documentTitle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {sameSelection ? (
        <p className="text-destructive text-sm" role="alert">
          Choose two different statements to compare.
        </p>
      ) : null}

      {chronologicalInvalid ? (
        <p className="text-destructive text-sm" role="alert">
          The earlier observation must have a valuation date on or before the
          later one. Swap your selections or pick different statements.
        </p>
      ) : null}

      {closingChange?.comparable ? (
        <p className="text-sm">
          {closingChange.message}{" "}
          <span className="font-medium">
            {displayAmount(closingChange.change)} {closingCurrency}
          </span>
          . This is not investment return.
        </p>
      ) : closingChange ? (
        <p className="text-muted-foreground text-sm">{closingChange.message}</p>
      ) : null}

      {comparison ? (
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {comparison.observations.length === 0 ? (
            <li>No deterministic holding changes detected.</li>
          ) : (
            comparison.observations.map((observation, index) => (
              <li key={index}>{observationLabel(observation)}</li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
