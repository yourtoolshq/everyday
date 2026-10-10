"use client";

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

import type { InvestmentStatementFormState } from "~/components/investment-statements/investment-form-state";
import type { TotalInput } from "~/modules/investment-statements/domain/snapshot-dto";
import type { SectionCoverage } from "~/server/db/schema";
import { emptyTotalRow } from "~/components/investment-statements/investment-form-state";
import {
  fieldDefinitions,
  sectionCoverageLabels,
  totalScopeLabels,
} from "~/components/investment-statements/investment-labels";
import { MoneyFieldGroup } from "~/components/investment-statements/money-field-group";

const flowFields: {
  key: keyof TotalInput;
  label: string;
}[] = [
  { key: "contributions", label: "Contributions" },
  { key: "withdrawals", label: "Withdrawals" },
  { key: "transfersIn", label: "Transfers in" },
  { key: "transfersOut", label: "Transfers out" },
  { key: "income", label: "Investment income" },
  { key: "fees", label: "Fees" },
  { key: "reportedValueChange", label: "Reported value change" },
];

export function InvestmentSummaryPanel({
  form,
  onChange,
}: {
  form: InvestmentStatementFormState;
  onChange: (next: InvestmentStatementFormState) => void;
}) {
  function updateTotals(nextTotals: TotalInput[]) {
    onChange({ ...form, totals: nextTotals });
  }

  function updateRow(index: number, patch: Partial<TotalInput>) {
    const next = [...form.totals];
    next[index] = { ...next[index]!, ...patch };
    updateTotals(next);
  }

  return (
    <section className="space-y-4" aria-labelledby="summary-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="summary-heading" className="text-base font-medium">
            Summary
          </h3>
          <p className="text-muted-foreground text-sm">
            Reported account totals and optional period flows. Leave fields
            blank when the statement does not report them.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="summary-coverage">Summary coverage</Label>
          <Select
            value={form.summaryCoverage}
            onValueChange={(value) =>
              onChange({
                ...form,
                summaryCoverage: value as SectionCoverage,
              })
            }
          >
            <SelectTrigger id="summary-coverage" className="w-44">
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

      {form.totals.map((row, index) => (
        <div key={index} className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Total row {index + 1}</p>
            {form.totals.length > 1 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() =>
                  updateTotals(form.totals.filter((_, i) => i !== index))
                }
              >
                <Trash2 />
                Remove row
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                value={row.currency}
                onChange={(event) =>
                  updateRow(index, {
                    currency: event.target.value.toUpperCase(),
                  })
                }
                maxLength={3}
                placeholder="CAD"
              />
            </div>
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select
                value={row.scope}
                onValueChange={(value) =>
                  updateRow(index, { scope: value as TotalInput["scope"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(totalScopeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <MoneyFieldGroup
              id={`closing-${index}`}
              label="Closing value"
              help={fieldDefinitions.closingValue}
              value={row.closingValue ?? ""}
              onValueChange={(value) =>
                updateRow(index, { closingValue: value || null })
              }
            />
            <MoneyFieldGroup
              id={`opening-${index}`}
              label="Opening value"
              help={fieldDefinitions.openingValue}
              value={row.openingValue ?? ""}
              onValueChange={(value) =>
                updateRow(index, { openingValue: value || null })
              }
            />
            <MoneyFieldGroup
              id={`cash-${index}`}
              label="Summary cash"
              help="Reported cash in the summary section, cross-checked against cash lines."
              value={row.cash ?? ""}
              onValueChange={(value) =>
                updateRow(index, { cash: value || null })
              }
            />
            <MoneyFieldGroup
              id={`book-${index}`}
              label="Book cost"
              help={fieldDefinitions.bookCost}
              value={row.bookCost ?? ""}
              onValueChange={(value) =>
                updateRow(index, { bookCost: value || null })
              }
            />
          </div>
          <details className="rounded-lg border border-dashed p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              Optional period flows
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {flowFields.map((field) => (
                <MoneyFieldGroup
                  key={field.key}
                  id={`${String(field.key)}-${index}`}
                  label={field.label}
                  help={
                    field.key === "reportedValueChange"
                      ? fieldDefinitions.reportedValueChange
                      : undefined
                  }
                  value={(row[field.key] as string | null) ?? ""}
                  onValueChange={(value) =>
                    updateRow(index, { [field.key]: value || null })
                  }
                />
              ))}
            </div>
          </details>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`source-page-total-${index}`}>Source page</Label>
              <Input
                id={`source-page-total-${index}`}
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
              <Label htmlFor={`source-note-total-${index}`}>Source note</Label>
              <Input
                id={`source-note-total-${index}`}
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
        onClick={() => updateTotals([...form.totals, emptyTotalRow()])}
      >
        <Plus />
        Add currency or component total
      </Button>
    </section>
  );
}
