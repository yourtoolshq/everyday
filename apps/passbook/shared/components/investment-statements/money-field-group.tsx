"use client";

import { useState } from "react";
import { Calculator, Info } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@yourtoolshq/ui/input-group";
import { Label } from "@yourtoolshq/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@yourtoolshq/ui/tooltip";

import {
  formatInvestmentAmount,
  normalizeInvestmentEntry,
} from "~/modules/investment-statements/domain/entry-helpers";

export function InvestmentMoneyInput({
  id,
  label,
  value,
  currency = "CAD",
  onValueChange,
  precision = 2,
  disabled = false,
}: {
  precision?: number;
  disabled?: boolean;
  id?: string;
  label: string;
  value: string;
  currency?: string;
  onValueChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editingValue, setEditingValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const display =
    !error && /^-?(?:\d+|\d*\.\d+)$/.test(value) && precision === 2
      ? formatInvestmentAmount(value)
      : value;
  return (
    <div className="space-y-1">
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText className="text-xs">{currency}</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          aria-label={label}
          inputMode="decimal"
          className="min-w-16 text-right tabular-nums"
          disabled={disabled}
          value={editing ? editingValue : display}
          onFocus={() => {
            setEditingValue(display);
            setEditing(true);
          }}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setError(null);
            setEditingValue(event.target.value);
            onValueChange(event.target.value);
          }}
          onBlur={() => {
            setEditing(false);
            const result = normalizeInvestmentEntry(editingValue, precision);
            if (result.ok) {
              setError(null);
              if (result.value !== value) onValueChange(result.value);
            } else setError(result.message);
          }}
        />
        <InputGroupAddon align="inline-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`Arithmetic help for ${label}`}
                className="text-muted-foreground"
              >
                <Calculator className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Enter a number or a + − × / expression.
            </TooltipContent>
          </Tooltip>
        </InputGroupAddon>
      </InputGroup>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
export function MoneyFieldGroup({
  id,
  label,
  help,
  value,
  currency,
  onValueChange,
  labelAction,
}: {
  id: string;
  label: string;
  help?: string;
  value: string;
  currency?: string;
  onValueChange: (value: string) => void;
  labelAction?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {help ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`About ${label}`}
                className="text-muted-foreground"
              >
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{help}</TooltipContent>
          </Tooltip>
        ) : null}
        {labelAction}
      </div>
      <InvestmentMoneyInput
        id={id}
        label={label}
        value={value}
        currency={currency}
        onValueChange={onValueChange}
      />
    </div>
  );
}
