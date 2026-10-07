import type { DesktopUpdateReleaseNote } from "./update-types.js";

const MAX_VERSION_GROUPS = 6;
const MAX_ITEMS_PER_GROUP = 8;
const MAX_ITEM_LENGTH = 240;

function stripMarkup(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeItems(raw: unknown): string[] {
  if (typeof raw === "string") {
    const item = stripMarkup(raw).slice(0, MAX_ITEM_LENGTH);
    return item ? [item] : [];
  }
  if (!Array.isArray(raw)) return [];
  const items: string[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      const item = stripMarkup(entry).slice(0, MAX_ITEM_LENGTH);
      if (item) items.push(item);
      continue;
    }
    if (typeof entry === "object" && entry !== null && "note" in entry) {
      const note = (entry as { note?: unknown }).note;
      if (typeof note === "string") {
        const item = stripMarkup(note).slice(0, MAX_ITEM_LENGTH);
        if (item) items.push(item);
      }
    }
  }
  return items.slice(0, MAX_ITEMS_PER_GROUP);
}

export function normalizeDesktopUpdateReleaseNotes(
  version: string,
  releaseNotes: unknown,
): DesktopUpdateReleaseNote[] {
  const items = normalizeItems(releaseNotes);
  if (items.length === 0) return [];
  return [{ version, items }];
}

export function mergeDesktopUpdateReleaseNotes(
  existing: readonly DesktopUpdateReleaseNote[],
  incoming: readonly DesktopUpdateReleaseNote[],
): DesktopUpdateReleaseNote[] {
  const merged = [...existing];
  for (const note of incoming) {
    const index = merged.findIndex((entry) => entry.version === note.version);
    if (index >= 0) {
      merged[index] = note;
    } else {
      merged.push(note);
    }
  }
  return merged.slice(0, MAX_VERSION_GROUPS);
}
