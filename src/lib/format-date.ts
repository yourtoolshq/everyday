export function formatDateLabel(value: string | null | undefined): string | null {
  if (!value) return null;

  const [year, month, day] = value.split("-");
  if (!year || !month) return value;

  const date = new Date(Number(year), Number(month) - 1, day ? Number(day) : 1);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: day ? "numeric" : undefined,
  });
}
