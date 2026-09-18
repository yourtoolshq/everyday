import type { AccountTermsField } from "~/lib/account-terms";
import { formatDateLabel } from "~/lib/format-date";

function toCanonicalNumber(value: number): string {
  return String(value);
}

function parseNumericInput(input: string): number | null {
  const cleaned = input.replace(/[$,%\s,]/g, "");
  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRateValue(input: string | null | undefined): string | null {
  const trimmed = input?.trim();
  if (!trimmed) return null;

  const parsed = parseNumericInput(trimmed);
  if (parsed === null) return trimmed;

  return toCanonicalNumber(parsed);
}

export function parseMoneyValue(input: string | null | undefined): string | null {
  const trimmed = input?.trim();
  if (!trimmed) return null;

  const parsed = parseNumericInput(trimmed);
  if (parsed === null) return trimmed;

  return toCanonicalNumber(parsed);
}

export function formatRateValue(value: string): string {
  const parsed = parseNumericInput(value);
  if (parsed === null) return value;

  return `${toCanonicalNumber(parsed)}%`;
}

const cadWholeFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

export function formatMoneyValue(
  value: string,
  variant: "whole" | "decimal" = "whole",
): string {
  const parsed = parseNumericInput(value);
  if (parsed === null) return value;

  if (variant === "whole") {
    return cadWholeFormatter.format(parsed);
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: Number.isInteger(parsed) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

export function formatTermValue(field: AccountTermsField, value: string): string {
  if (field === "renewalDate" || field === "promotionalInterestRateExpires") {
    return formatDateLabel(value) ?? value;
  }

  if (field === "interestRate" || field === "promotionalInterestRate") {
    return formatRateValue(value);
  }

  if (field === "creditLimit") {
    return formatMoneyValue(value, "whole");
  }

  if (field === "annualFee") {
    return formatMoneyValue(value, "decimal");
  }

  return value;
}
