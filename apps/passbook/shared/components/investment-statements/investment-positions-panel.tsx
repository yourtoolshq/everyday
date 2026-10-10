"use client";

import { Fragment, useState } from "react";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";

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
  const columnHelp: Readonly<Record<string, string>> = {
    Quantity: fieldDefinitions.quantity,
    "Unit price": fieldDefinitions.unitPrice,
    "Market value": fieldDefinitions.marketValue,
    "Book cost": fieldDefinitions.bookCost,
  };
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
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
            Enter values as printed. Leave unreported values blank. Use Details
            for source references and other currencies.
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

      <fieldset
        disabled={pickerIndex != null}
        className="min-w-0 space-y-4 border-0 p-0"
      >
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">
              Enter holdings as printed on the statement. Blank values mean
              unknown.
            </caption>
            <thead className="bg-muted/40 text-muted-foreground text-left">
              <tr>
                {[
                  "Holding / printed label",
                  "Currency",
                  "Quantity",
                  "Unit price",
                  "Market value",
                  "Book cost",
                  "Actions",
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    title={columnHelp[label]}
                    className="px-2 py-3 font-medium"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.positions.map((row, index) => (
                <Fragment key={index}>
                  <tr className="border-t align-top">
                    <td className="min-w-44 space-y-1 p-2">
                      <Input
                        id={`source-label-${index}`}
                        aria-label={`Source label ${index + 1}`}
                        value={row.sourceLabel}
                        placeholder="As printed"
                        onChange={(event) =>
                          updateRow(index, { sourceLabel: event.target.value })
                        }
                      />
                      {row.lineKind === "investment" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-auto max-w-40 justify-start px-1 py-1 text-left text-xs whitespace-normal"
                          onClick={() => setPickerIndex(index)}
                        >
                          {row.instrumentId
                            ? (instrumentNames[row.instrumentId] ??
                              "Change instrument")
                            : "Link instrument"}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {positionLineKindLabels[row.lineKind]}
                        </span>
                      )}
                    </td>
                    <td className="w-20 p-2">
                      <Input
                        id={`value-currency-${index}`}
                        aria-label={`Value currency ${index + 1}`}
                        value={row.valueCurrency}
                        maxLength={3}
                        onChange={(event) =>
                          updateRow(index, {
                            valueCurrency: event.target.value.toUpperCase(),
                          })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        id={`quantity-${index}`}
                        aria-label={`Quantity ${index + 1}`}
                        className="min-w-16 text-right tabular-nums"
                        inputMode="decimal"
                        disabled={row.lineKind === "cash"}
                        value={row.quantity ?? ""}
                        onChange={(event) =>
                          updateRow(index, {
                            quantity: event.target.value || null,
                          })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        id={`unit-price-${index}`}
                        aria-label={`Unit price ${index + 1}`}
                        className="min-w-16 text-right tabular-nums"
                        inputMode="decimal"
                        disabled={row.lineKind === "cash"}
                        value={row.unitPrice ?? ""}
                        onChange={(event) =>
                          updateRow(index, {
                            unitPrice: event.target.value || null,
                            unitPriceCurrency:
                              row.unitPriceCurrency ||
                              row.valueCurrency ||
                              null,
                          })
                        }
                      />
                      <span className="text-muted-foreground text-xs">
                        {row.unitPriceCurrency}
                      </span>
                    </td>
                    <td className="p-2">
                      <Input
                        id={`market-value-${index}`}
                        aria-label={`Market value ${index + 1}`}
                        className="min-w-20 text-right tabular-nums"
                        inputMode="decimal"
                        value={row.marketValue ?? ""}
                        onChange={(event) =>
                          updateRow(index, {
                            marketValue: event.target.value || null,
                          })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        id={`position-book-${index}`}
                        aria-label={`Book cost ${index + 1}`}
                        className="min-w-20 text-right tabular-nums"
                        inputMode="decimal"
                        value={row.bookCost ?? ""}
                        onChange={(event) =>
                          updateRow(index, {
                            bookCost: event.target.value || null,
                            bookCostCurrency:
                              row.bookCostCurrency || row.valueCurrency || null,
                          })
                        }
                      />
                      <span className="text-muted-foreground text-xs">
                        {row.bookCostCurrency}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Details line ${index + 1}`}
                          title="Line details and source references"
                          aria-expanded={expandedIndex === index}
                          onClick={() =>
                            setExpandedIndex(
                              expandedIndex === index ? null : index,
                            )
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Remove line ${index + 1}`}
                          onClick={() => {
                            updatePositions(
                              form.positions.filter((_, i) => i !== index),
                            );
                            setExpandedIndex(null);
                            setPickerIndex(null);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expandedIndex === index ? (
                    <tr className="bg-muted/20">
                      <td colSpan={7} className="p-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1">
                            <Label htmlFor={`line-kind-${index}`}>
                              Line kind
                            </Label>
                            <Select
                              value={row.lineKind}
                              onValueChange={(value) =>
                                updateRow(index, {
                                  lineKind: value as PositionInput["lineKind"],
                                  ...(value === "cash"
                                    ? {
                                        instrumentId: null,
                                        quantity: null,
                                        unitPrice: null,
                                        unitPriceCurrency: null,
                                      }
                                    : {}),
                                })
                              }
                            >
                              <SelectTrigger id={`line-kind-${index}`}>
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
                          {(
                            [
                              [
                                "sourceIdentifier",
                                "Source identifier",
                                "source-id",
                              ],
                              [
                                "sourceSeries",
                                "Source series",
                                "source-series",
                              ],
                              [
                                "unitPriceCurrency",
                                "Unit price currency",
                                "unit-price-currency",
                              ],
                              [
                                "bookCostCurrency",
                                "Book cost currency",
                                "book-currency",
                              ],
                              ["sourceNote", "Source note", "source-note"],
                            ] as const
                          ).map(([key, label, id]) => (
                            <div key={key} className="space-y-1">
                              <Label htmlFor={`${id}-${index}`}>{label}</Label>
                              <Input
                                id={`${id}-${index}`}
                                value={row[key] ?? ""}
                                onChange={(event) =>
                                  updateRow(index, {
                                    [key]: key.endsWith("Currency")
                                      ? event.target.value.toUpperCase() || null
                                      : event.target.value || null,
                                  })
                                }
                              />
                            </div>
                          ))}
                          <div className="space-y-1">
                            <Label htmlFor={`source-page-${index}`}>
                              Source page
                            </Label>
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
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            updatePositions([...form.positions, emptyPositionRow()])
          }
        >
          <Plus />
          Add line
        </Button>
      </fieldset>
      {pickerIndex != null ? (
        <InstrumentPickerSheet
          open={pickerIndex != null}
          onOpenChange={(open) => {
            if (!open) setPickerIndex(null);
          }}
          accountId={accountId}
          documentId={documentId}
          initialName={form.positions[pickerIndex]?.sourceLabel}
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
