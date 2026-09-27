import { normalizeDecimalEntry } from "@yourtoolshq/ui/decimal-entry";

export function formatCad(cents: number | null) {
  if (cents === null) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function dollarsToCents(value: string): number | null {
  const result = normalizeDecimalEntry(value);
  if (!result.ok || result.value === "") return null;
  const amount = Number(result.value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export function centsToDollars(value: number | null) {
  return value === null ? "" : (value / 100).toFixed(2);
}

export function signedDollarsToCents(value: string): number | null {
  const result = normalizeDecimalEntry(value);
  if (!result.ok || result.value === "") return null;
  const amount = Number(result.value);
  if (!Number.isFinite(amount) || amount === 0) return null;
  return Math.round(amount * 100);
}

export function signedCentsToDollars(value: number | null) {
  return value === null ? "" : (Math.abs(value) / 100).toFixed(2);
}

export function formatSignedCad(cents: number | null) {
  if (cents === null) return "—";
  if (cents === 0) return formatCad(0);
  const label = cents > 0 ? "Refund" : "Owing";
  return `${label} ${formatCad(Math.abs(cents))}`;
}
