export function dollarsToCents(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim().replaceAll(",", "");
  if (normalized === "") return null;

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export function centsToDollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

export function formatCad(cents: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}
