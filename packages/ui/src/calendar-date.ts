/** Calendar date as `YYYY-MM-DD`, interpreted in the local calendar. */
export function parseCalendarDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

export function formatCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const dateInputFormat: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "long",
  year: "numeric",
};

/** Display used by the typeable date field, such as `June 01, 2025`. */
export function formatCalendarDateInput(date: Date): string {
  return date.toLocaleDateString("en-CA", dateInputFormat);
}

export function formatCalendarDateLabel(value: string): string {
  const date = parseCalendarDate(value);
  if (!date) return "";
  return formatCalendarDateInput(date);
}

/**
 * Parse a typed date without shifting the calendar day.
 * `YYYY-MM-DD` is local. Other text follows the date picker's
 * `June 01, 2025` input, including short month names.
 */
export function parseTypedCalendarDate(value: string): Date | undefined {
  const text = value.trim();
  if (!text) return undefined;

  const iso = parseCalendarDate(text);
  if (iso) return iso;
  if (/^\d{4}(-\d{2}){0,2}$/.test(text)) return undefined;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}
