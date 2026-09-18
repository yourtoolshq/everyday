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

export const accountDocumentTypes = documentTypes.filter((type) => type !== "statement");

export type AccountDocumentType = (typeof accountDocumentTypes)[number];

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

export const statementMetadataSchema = documentMetadataSchema.extend({
  type: z.literal("statement"),
  periodKey: z.string().trim().min(1),
});

export const maxDocumentBytes = 25 * 1024 * 1024;

type DetectedFile = { mimeType: string; extension: string };

const heicBrands = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis"]);

const audioSignatures: Array<{
  mimeType: string;
  extension: string;
  match: (bytes: Uint8Array) => boolean;
}> = [
  {
    mimeType: "audio/mpeg",
    extension: "mp3",
    match: (bytes) =>
      bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33,
  },
  {
    mimeType: "audio/mp4",
    extension: "m4a",
    match: (bytes) =>
      bytes.length >= 12 &&
      ascii(bytes, 4, 8) === "ftyp" &&
      (ascii(bytes, 8, 12) === "M4A " || ascii(bytes, 8, 12) === "mp42"),
  },
  {
    mimeType: "audio/wav",
    extension: "wav",
    match: (bytes) =>
      bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WAVE",
  },
  {
    mimeType: "audio/ogg",
    extension: "ogg",
    match: (bytes) => bytes.length >= 4 && ascii(bytes, 0, 4) === "OggS",
  },
];

export function detectDocumentFile(bytes: Uint8Array, filename?: string): DetectedFile | null {
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

  if (looksLikeEml(bytes, filename)) {
    return { mimeType: "message/rfc822", extension: "eml" };
  }

  for (const signature of audioSignatures) {
    if (signature.match(bytes)) {
      return { mimeType: signature.mimeType, extension: signature.extension };
    }
  }

  if (filename) {
    const extension = filename.split(".").pop()?.toLowerCase();
    if (extension === "eml") return { mimeType: "message/rfc822", extension: "eml" };
    if (extension === "mp3") return { mimeType: "audio/mpeg", extension: "mp3" };
    if (extension === "m4a") return { mimeType: "audio/mp4", extension: "m4a" };
    if (extension === "wav") return { mimeType: "audio/wav", extension: "wav" };
    if (extension === "ogg") return { mimeType: "audio/ogg", extension: "ogg" };
  }

  return null;
}

function looksLikeEml(bytes: Uint8Array, filename?: string) {
  if (filename?.toLowerCase().endsWith(".eml")) return true;
  const limit = Math.min(bytes.length, 4096);
  const sample = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, limit));
  return /^(from|received|return-path|message-id|date|subject|mime-version):/im.test(sample);
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
