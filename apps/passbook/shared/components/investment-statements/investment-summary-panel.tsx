"use client";

import { ChevronDown, Plus, X } from "lucide-react";

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

import type { InvestmentStatementFormState } from "./investment-form-state";
import type {
  EntryPreferences,
  SummaryField,
} from "~/modules/investment-statements/domain/entry-preferences";
import type { TotalInput } from "~/modules/investment-statements/domain/snapshot-dto";
import {
  optionalSummaryFields,
  populatedOptionalFields,
  summaryAliases,
  summaryFieldLabels,
} from "~/modules/investment-statements/domain/entry-preferences";
import {
  FieldMenu,
  FieldMenuContent,
  FieldMenuItem,
  FieldMenuTrigger,
} from "./field-menu";
import { emptyTotalRow } from "./investment-form-state";
import { fieldDefinitions } from "./investment-labels";
import { MoneyFieldGroup } from "./money-field-group";

export function InvestmentSummaryPanel({
  form,
  onChange,
  preferences,
  onPreferencesChange,
}: {
  form: InvestmentStatementFormState;
  onChange: (next: InvestmentStatementFormState) => void;
  preferences: EntryPreferences;
  onPreferencesChange: (next: EntryPreferences) => void;
}) {
  const optional = [
    ...new Set([
      ...preferences.fields,
      ...populatedOptionalFields(form.totals),
    ]),
  ];
  const fields: SummaryField[] = [
    "openingValue",
    "closingValue",
    "bookCost",
    ...optional,
  ];
  function update(index: number, patch: Partial<TotalInput>) {
    onChange({
      ...form,
      totals: form.totals.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    });
  }
  const help: Partial<Record<SummaryField, string>> = {
    openingValue: fieldDefinitions.openingValue,
    closingValue: fieldDefinitions.closingValue,
    bookCost: fieldDefinitions.bookCost,
    cash: "Cash remaining in the account, separate from total portfolio value.",
    withdrawals:
      "Money withdrawn from the account. Purchases within the account are not withdrawals.",
    reportedValueChange: fieldDefinitions.reportedValueChange,
  };
  return (
    <section className="space-y-6" aria-labelledby="summary-heading">
      <div>
        <h3 id="summary-heading" className="text-lg font-semibold">
          Account summary
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Start with the totals. Add other figures your statement reports.
        </p>
      </div>
      {form.totals.map((row, index) => (
        <div key={index} className="space-y-5">
          <div className="flex items-end gap-3">
            <div className="w-28 space-y-2">
              <Label htmlFor={`summary-currency-${index}`}>Currency</Label>
              <Input
                id={`summary-currency-${index}`}
                value={row.currency}
                maxLength={3}
                onChange={(e) =>
                  update(index, { currency: e.target.value.toUpperCase() })
                }
                onBlur={() => {
                  if (index === 0 && /^[A-Z]{3}$/.test(row.currency))
                    onPreferencesChange({
                      ...preferences,
                      currency: row.currency,
                    });
                }}
              />
            </div>
            {index > 0 || row.scope !== "account_total" ? (
              <div className="flex-1 space-y-2">
                <Label>Scope</Label>
                <Select
                  value={row.scope}
                  onValueChange={(scope) =>
                    update(index, { scope: scope as TotalInput["scope"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account_total">Account total</SelectItem>
                    <SelectItem value="currency_component">
                      Currency component
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {index > 0 ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove total ${index + 1}`}
                onClick={() =>
                  onChange({
                    ...form,
                    totals: form.totals.filter((_, i) => i !== index),
                  })
                }
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
          <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
            {fields.map((key) => (
              <MoneyFieldGroup
                key={key}
                id={`${key}-${index}`}
                label={preferences.aliases[key] ?? summaryFieldLabels[key]}
                help={help[key]}
                currency={row.currency}
                value={row[key] ?? ""}
                onValueChange={(value) =>
                  update(index, { [key]: value || null })
                }
                labelAction={
                  summaryAliases[key] ? (
                    <FieldMenu>
                      <FieldMenuTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground"
                          aria-label={`Change label for ${summaryFieldLabels[key]}`}
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                      </FieldMenuTrigger>
                      <FieldMenuContent>
                        {summaryAliases[key]!.map((alias) => (
                          <FieldMenuItem
                            key={alias}
                            onSelect={() =>
                              onPreferencesChange({
                                ...preferences,
                                aliases: {
                                  ...preferences.aliases,
                                  [key]: alias,
                                },
                              })
                            }
                          >
                            {alias}
                          </FieldMenuItem>
                        ))}
                      </FieldMenuContent>
                    </FieldMenu>
                  ) : undefined
                }
              />
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <FieldMenu>
          <FieldMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus />
              Add fields
            </Button>
          </FieldMenuTrigger>
          <FieldMenuContent>
            {optionalSummaryFields
              .filter((key) => !optional.includes(key))
              .map((key) => (
                <FieldMenuItem
                  key={key}
                  onSelect={() =>
                    onPreferencesChange({
                      ...preferences,
                      fields: [...preferences.fields, key],
                    })
                  }
                >
                  {summaryFieldLabels[key]}
                </FieldMenuItem>
              ))}
            {optional.length === optionalSummaryFields.length ? (
              <FieldMenuItem disabled>All fields are shown</FieldMenuItem>
            ) : null}
          </FieldMenuContent>
        </FieldMenu>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              ...form,
              totals: [...form.totals, emptyTotalRow(preferences.currency)],
            })
          }
        >
          Add currency or component
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Field choices and labels are remembered for this account. Leave
        unreported values blank.
      </p>
    </section>
  );
}
