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
  return formatMoney(cents, "CAD");
}

export function formatMoney(
  cents: number,
  currency: "CAD" | "INR",
  options?: { maximumFractionDigits?: number },
): string {
  const locale = currency === "INR" ? "en-IN" : "en-CA";
  const maximumFractionDigits =
    options?.maximumFractionDigits ?? (currency === "INR" ? 0 : 2);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits === 0 ? 0 : 2,
  }).format(cents / 100);
}
