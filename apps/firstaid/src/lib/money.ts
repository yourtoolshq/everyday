/**
 * Parse a dollar amount string into integer cents without floating-point math.
 * Returns null for empty or invalid input.
 */
export function parseDollarsToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;

  const parts = normalized.split(".");
  const dollarsPart = parts[0] ?? "";
  const centsPart = parts[1] ?? "";
  const dollars = Number.parseInt(dollarsPart, 10);
  if (!Number.isFinite(dollars) || dollars < 0) return null;

  const paddedCents = centsPart.padEnd(2, "0").slice(0, 2);
  const cents = paddedCents ? Number.parseInt(paddedCents, 10) : 0;
  if (!Number.isFinite(cents) || cents < 0 || cents > 99) return null;

  return dollars * 100 + cents;
}

/** Format integer cents as a dollar string, e.g. 12345 -> "$123.45". */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  return `${sign}$${dollars}.${remainder.toString().padStart(2, "0")}`;
}

/** Sum integer cent values safely. */
export function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
