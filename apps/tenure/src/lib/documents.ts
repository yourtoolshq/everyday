import { z } from "zod";

export const documentTypes = [
  "contract",
  "offer_letter",
  "employment_letter",
  "promotion_letter",
  "salary_letter",
  "pay_stub",
  "other",
] as const;

export type DocumentType = (typeof documentTypes)[number];

export const documentTypeLabels = {
  contract: "Contract",
  offer_letter: "Offer letter",
  employment_letter: "Employment letter",
  promotion_letter: "Promotion letter",
  salary_letter: "Salary letter",
  pay_stub: "Pay stub",
  other: "Other",
} satisfies Record<DocumentType, string>;

export const documentMetadataSchema = z.object({
  title: z.string().trim().min(1).max(160),
  type: z.enum(documentTypes),
  documentDate: z.string().trim().max(10).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  discussionId: z.string().uuid().nullable().optional(),
});

export const maxDocumentBytes = 25 * 1024 * 1024;

type DetectedFile = { mimeType: string; extension: string };

const heicBrands = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis"]);

export function detectDocumentFile(
  bytes: Uint8Array,
  filename?: string,
): DetectedFile | null {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return { mimeType: "application/pdf", extension: "pdf" };
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 12) === "WEBP"
  ) {
    return { mimeType: "image/webp", extension: "webp" };
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 4, 8) === "ftyp" &&
    hasHeicBrand(bytes)
  ) {
    return { mimeType: "image/heic", extension: "heic" };
  }

  if (looksLikeEml(bytes, filename)) {
    return { mimeType: "message/rfc822", extension: "eml" };
  }

  if (filename?.toLowerCase().endsWith(".eml")) {
    return { mimeType: "message/rfc822", extension: "eml" };
  }

  return null;
}

function looksLikeEml(bytes: Uint8Array, filename?: string) {
  if (filename?.toLowerCase().endsWith(".eml")) return true;
  const limit = Math.min(bytes.length, 4096);
  const sample = new TextDecoder("utf-8", { fatal: false }).decode(
    bytes.subarray(0, limit),
  );
  return /^(from|received|return-path|message-id|date|subject|mime-version):/im.test(
    sample,
  );
}

export function isEmlMimeType(mimeType: string) {
  return mimeType === "message/rfc822";
}

function hasHeicBrand(bytes: Uint8Array) {
  if (heicBrands.has(ascii(bytes, 8, 12))) return true;
  for (let offset = 16; offset + 4 <= Math.min(bytes.length, 64); offset += 4) {
    if (heicBrands.has(ascii(bytes, offset, offset + 4))) return true;
  }
  return false;
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

export function titleFromFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "").trim();
  return (withoutExtension || filename.trim() || "Document").slice(0, 160);
}

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateLabel(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const date = new Date(`${value.trim()}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
