import { z } from "zod";

export const documentTypes = [
  "statement",
  "notice",
  "agreement",
  "opening_document",
  "closure_document",
  "financial_correspondence",
  "other",
] as const;

export type DocumentType = (typeof documentTypes)[number];

export const documentTypeLabels = {
  statement: "Statement",
  notice: "Notice",
  agreement: "Agreement",
  opening_document: "Opening document",
  closure_document: "Closure document",
  financial_correspondence: "Financial correspondence",
  other: "Other",
} satisfies Record<DocumentType, string>;

export const documentMetadataSchema = z.object({
  title: z.string().trim().min(1).max(160),
  type: z.enum(documentTypes),
  documentDate: z.string().trim().max(10).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const maxDocumentBytes = 25 * 1024 * 1024;

type DetectedFile = { mimeType: string; extension: string };

const heicBrands = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis"]);

export function detectDocumentFile(bytes: Uint8Array): DetectedFile | null {
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
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
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
  return null;
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
