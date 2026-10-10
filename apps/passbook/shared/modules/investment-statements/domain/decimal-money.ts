import Decimal from "decimal.js";

import { invalidInput, isAppError } from "@yourtoolshq/server/errors";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Z]{3}$/;

/** Maximum significant digits accepted on persisted and API inputs. */
export const DECIMAL_PRECISION = 40;
const MAX_FRACTION_DIGITS = 20;
/** Headroom for sums and differences of bounded inputs without losing fraction. */
const ARITHMETIC_PRECISION = DECIMAL_PRECISION + MAX_FRACTION_DIGITS + 10;

const investmentDecimal = Decimal.clone({
  precision: ARITHMETIC_PRECISION,
  rounding: Decimal.ROUND_HALF_UP,
});

const STRICT_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$|^-?\.\d+$/;

function assertDecimalShape(trimmed: string, label: string): void {
  if (!STRICT_DECIMAL.test(trimmed)) {
    throw invalidInput(`${label} is not a valid decimal value.`);
  }
  const unsigned = trimmed.startsWith("-") ? trimmed.slice(1) : trimmed;
  const [whole = "", fraction = ""] = unsigned.split(".");
  const digitCount = whole.replace(/^0+/, "").length + fraction.length;
  if (digitCount > DECIMAL_PRECISION) {
    throw invalidInput(
      `${label} exceeds the maximum of ${DECIMAL_PRECISION} significant digits.`,
    );
  }
  if (fraction.length > MAX_FRACTION_DIGITS) {
    throw invalidInput(
      `${label} exceeds the maximum of ${MAX_FRACTION_DIGITS} decimal places.`,
    );
  }
}

export function parseDecimalAmount(
  value: string,
  label = "Amount",
): Decimal | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  assertDecimalShape(trimmed, label);
  try {
    const parsed = new investmentDecimal(trimmed);
    if (!parsed.isFinite()) {
      throw invalidInput(`${label} must be a finite number.`);
    }
    return parsed;
  } catch (error) {
    if (isAppError(error)) throw error;
    throw invalidInput(`${label} is not a valid decimal value.`);
  }
}

export function normalizeDecimalString(
  value: string,
  label = "Amount",
): string {
  const parsed = parseDecimalAmount(value, label);
  if (!parsed) {
    throw invalidInput(`${label} cannot be empty.`);
  }
  return parsed.toFixed();
}

export function normalizeNullableDecimalString(
  value: string | null | undefined,
  label = "Amount",
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return normalizeDecimalString(trimmed, label);
}

export function validateIsoDate(value: string, label = "Date"): string {
  const trimmed = value.trim();
  if (!ISO_DATE.test(trimmed)) {
    throw invalidInput(`${label} must use YYYY-MM-DD format.`);
  }
  const parts = trimmed.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    throw invalidInput(`${label} is not a valid calendar date.`);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw invalidInput(`${label} is not a valid calendar date.`);
  }
  return trimmed;
}

export function validateNullableIsoDate(
  value: string | null | undefined,
  label = "Date",
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return validateIsoDate(trimmed, label);
}

export function validateCurrency(value: string, label = "Currency"): string {
  const trimmed = value.trim().toUpperCase();
  if (!CURRENCY.test(trimmed)) {
    throw invalidInput(`${label} must be a three-letter ISO code.`);
  }
  return trimmed;
}

export function addAmounts(values: (string | null | undefined)[]): Decimal {
  return values.reduce((sum, value) => {
    if (value === null || value === undefined) return sum;
    const trimmed = value.trim();
    if (!trimmed) return sum;
    return sum.plus(parseDecimalAmount(trimmed)!);
  }, new investmentDecimal(0));
}

export function subtractAmounts(
  left: string | null | undefined,
  right: string | null | undefined,
): Decimal | null {
  if (left === null || left === undefined || !left.trim()) return null;
  if (right === null || right === undefined || !right.trim()) return null;
  return parseDecimalAmount(left)!.minus(parseDecimalAmount(right)!);
}

export function decimalEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = a?.trim();
  const right = b?.trim();
  if (!left && !right) return true;
  if (!left || !right) return false;
  return parseDecimalAmount(left)!.equals(parseDecimalAmount(right)!);
}

export function roundingToleranceFor(values: string[]): Decimal {
  let maxFractionDigits = 2;
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(".");
    if (parts.length === 2 && parts[1]) {
      maxFractionDigits = Math.max(maxFractionDigits, parts[1].length);
    }
  }
  return new investmentDecimal(1).div(
    new investmentDecimal(10).pow(maxFractionDigits),
  );
}
