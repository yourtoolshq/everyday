"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@yourtoolshq/ui/button";
import { Input } from "@yourtoolshq/ui/input";
import { Label } from "@yourtoolshq/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@yourtoolshq/ui/select";

import type { InstrumentRecord } from "~/components/investment-statements/instrument-sheets";
import type { InvestmentStatementFormState } from "~/components/investment-statements/investment-form-state";
import type { PositionInput } from "~/modules/investment-statements/domain/snapshot-dto";
import type { SectionCoverage } from "~/server/db/schema";
import { InstrumentPickerSheet } from "~/components/investment-statements/instrument-sheets";
import { emptyPositionRow } from "~/components/investment-statements/investment-form-state";
import {
  fieldDefinitions,
  positionLineKindLabels,
  sectionCoverageLabels,
} from "~/components/investment-statements/investment-labels";
import { MoneyFieldGroup } from "~/components/investment-statements/money-field-group";

export function InvestmentPositionsPanel({
  form,
  onChange,
  accountId,
  documentId,
  instrumentNames = {},
}: {
  form: InvestmentStatementFormState;
  onChange: (next: InvestmentStatementFormState) => void;
  accountId: string;
  documentId: string;
  instrumentNames?: Readonly<Record<string, string>>;
}) {
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  function updatePositions(next: PositionInput[]) {
    onChange({ ...form, positions: next });
  }

  function updateRow(index: number, patch: Partial<PositionInput>) {
    const next = [...form.positions];
    next[index] = { ...next[index]!, ...patch };
    updatePositions(next);
  }

  return (
    <section className="space-y-4" aria-labelledby="holdings-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="holdings-heading" className="text-base font-medium">
            Holdings and cash
          </h3>
          <p className="text-muted-foreground text-sm">
            Preserve labels as printed. Multiple lines for the same instrument
            are allowed. Omitted lines are not treated as sold.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="holdings-coverage">Holdings coverage</Label>
          <Select
            value={form.holdingsCoverage}
            onValueChange={(value) =>
              onChange({
                ...form,
                holdingsCoverage: value as SectionCoverage,
              })
            }
          >
            <SelectTrigger id="holdings-coverage" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(sectionCoverageLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.positions.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          No lines yet. Add investments, cash, or other reported products.
        </p>
      ) : null}

      {form.positions.map((row, index) => (
        <div key={index} className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Line {index + 1}</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() =>
                updatePositions(form.positions.filter((_, i) => i !== index))
              }
            >
              <Trash2 />
              Remove
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Line kind</Label>
              <Select
                value={row.lineKind}
                onValueChange={(value) =>
                  updateRow(index, {
                    lineKind: value as PositionInput["lineKind"],
                    instrumentId: value === "cash" ? null : row.instrumentId,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(positionLineKindLabels).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor={`source-label-${index}`}>Source label</Label>
              <Input
                id={`source-label-${index}`}
                value={row.sourceLabel}
                onChange={(event) =>
                  updateRow(index, { sourceLabel: event.target.value })
                }
              />
            </div>
          </div>
          {row.lineKind === "investment" ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Label>Instrument</Label>
                <p className="text-sm">
                  {row.instrumentId
                    ? (instrumentNames[row.instrumentId] ?? row.instrumentId)
                    : "Not linked yet"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPickerIndex(index)}
              >
                {row.instrumentId ? "Change" : "Link instrument"}
              </Button>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`value-currency-${index}`}>Value currency</Label>
              <Input
                id={`value-currency-${index}`}
                value={row.valueCurrency}
                onChange={(event) =>
                  updateRow(index, {
                    valueCurrency: event.target.value.toUpperCase(),
                  })
                }
                maxLength={3}
              />
            </div>
            <MoneyFieldGroup
              id={`market-value-${index}`}
              label="Market value"
              help={fieldDefinitions.marketValue}
              value={row.marketValue ?? ""}
              onValueChange={(value) =>
                updateRow(index, { marketValue: value || null })
              }
            />
            <MoneyFieldGroup
              id={`quantity-${index}`}
              label="Quantity"
              help={fieldDefinitions.quantity}
              value={row.quantity ?? ""}
              onValueChange={(value) =>
                updateRow(index, { quantity: value || null })
              }
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <MoneyFieldGroup
              id={`unit-price-${index}`}
              label="Unit price"
              help={fieldDefinitions.unitPrice}
              value={row.unitPrice ?? ""}
              onValueChange={(value) =>
                updateRow(index, { unitPrice: value || null })
              }
            />
            <div className="space-y-2">
              <Label htmlFor={`unit-price-currency-${index}`}>
                Unit price currency
              </Label>
              <Input
                id={`unit-price-currency-${index}`}
                value={row.unitPriceCurrency ?? ""}
                onChange={(event) =>
                  updateRow(index, {
                    unitPriceCurrency: event.target.value.toUpperCase() || null,
                  })
                }
                maxLength={3}
              />
            </div>
            <MoneyFieldGroup
              id={`position-book-${index}`}
              label="Book cost"
              help={fieldDefinitions.bookCost}
              value={row.bookCost ?? ""}
              onValueChange={(value) =>
                updateRow(index, { bookCost: value || null })
              }
            />
            <div className="space-y-2">
              <Label htmlFor={`book-currency-${index}`}>
                Book cost currency
              </Label>
              <Input
                id={`book-currency-${index}`}
                value={row.bookCostCurrency ?? ""}
                onChange={(event) =>
                  updateRow(index, {
                    bookCostCurrency: event.target.value.toUpperCase() || null,
                  })
                }
                maxLength={3}
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`source-id-${index}`}>Source identifier</Label>
              <Input
                id={`source-id-${index}`}
                value={row.sourceIdentifier ?? ""}
                onChange={(event) =>
                  updateRow(index, {
                    sourceIdentifier: event.target.value || null,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`source-series-${index}`}>Source series</Label>
              <Input
                id={`source-series-${index}`}
                value={row.sourceSeries ?? ""}
                onChange={(event) =>
                  updateRow(index, { sourceSeries: event.target.value || null })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`source-page-${index}`}>Source page</Label>
              <Input
                id={`source-page-${index}`}
                inputMode="numeric"
                value={row.sourcePage ?? ""}
                onChange={(event) =>
                  updateRow(index, {
                    sourcePage: event.target.value
                      ? Number.parseInt(event.target.value, 10)
                      : null,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`source-note-${index}`}>Source note</Label>
              <Input
                id={`source-note-${index}`}
                value={row.sourceNote ?? ""}
                onChange={(event) =>
                  updateRow(index, { sourceNote: event.target.value || null })
                }
              />
            </div>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => updatePositions([...form.positions, emptyPositionRow()])}
      >
        <Plus />
        Add line
      </Button>

      {pickerIndex != null ? (
        <InstrumentPickerSheet
          open={pickerIndex != null}
          onOpenChange={(open) => {
            if (!open) setPickerIndex(null);
          }}
          accountId={accountId}
          documentId={documentId}
          onSelect={(instrument: InstrumentRecord) => {
            updateRow(pickerIndex, {
              instrumentId: instrument.id,
              sourceLabel:
                form.positions[pickerIndex]?.sourceLabel ||
                instrument.displayName,
              sourceSeries: instrument.series,
            });
            setPickerIndex(null);
          }}
        />
      ) : null}
    </section>
  );
}
