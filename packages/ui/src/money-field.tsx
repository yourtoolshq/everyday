"use client";

import { useState } from "react";
import { CalculatorIcon } from "lucide-react";

import { normalizeDecimalEntry } from "./decimal-entry";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "./input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

interface MoneyFieldProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  readOnly?: boolean;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  /** Show the trailing calculator and accept + - * / on commit. */
  arithmetic?: boolean;
  error?: string;
}

export function MoneyField({
  id,
  name,
  value,
  defaultValue = "",
  onValueChange,
  readOnly,
  required,
  disabled,
  placeholder,
  "aria-label": ariaLabel,
  arithmetic = true,
  error,
}: MoneyFieldProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const [internalError, setInternalError] = useState<string | undefined>();
  const current = value ?? uncontrolled;
  const message = error ?? internalError;
  const showCalculator = arithmetic && !readOnly && !disabled;

  function setCurrent(next: string) {
    if (value === undefined) setUncontrolled(next);
    onValueChange?.(next);
  }

  return (
    <div className="space-y-1">
      <InputGroup>
        <InputGroupInput
          id={id}
          name={name}
          aria-label={ariaLabel}
          className="tabular-nums"
          inputMode="decimal"
          value={current}
          placeholder={placeholder}
          readOnly={readOnly}
          required={required}
          disabled={disabled}
          aria-invalid={Boolean(message)}
          onChange={(event) => {
            setInternalError(undefined);
            setCurrent(event.target.value);
          }}
          onBlur={() => {
            if (!showCalculator) return;
            const result = normalizeDecimalEntry(current);
            if (result.ok) {
              setInternalError(undefined);
              if (result.value !== current) setCurrent(result.value);
              return;
            }
            setInternalError(result.message);
          }}
        />
        <InputGroupAddon>
          <InputGroupText>$</InputGroupText>
        </InputGroupAddon>
        {showCalculator ? (
          <InputGroupAddon align="inline-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Arithmetic enabled. Enter a number or a + - * / total."
                >
                  <CalculatorIcon />
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>
                Enter a number or a + - * / total, such as 10+12+34.5
              </TooltipContent>
            </Tooltip>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
      {message ? <p className="text-destructive text-xs">{message}</p> : null}
    </div>
  );
}
