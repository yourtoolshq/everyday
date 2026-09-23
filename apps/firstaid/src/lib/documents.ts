import { z } from "zod";

export const documentTypes = [
  "intake_form",
  "receipt",
  "prescription",
  "referral",
  "requisition",
  "report",
  "result",
  "claim_record",
  "explanation_of_benefits",
  "other",
] as const;

export const documentTypeLabels = {
  intake_form: "Intake form",
  receipt: "Receipt",
  prescription: "Prescription",
  referral: "Referral",
  requisition: "Requisition",
  report: "Report",
  result: "Result",
  claim_record: "Claim record",
  explanation_of_benefits: "Explanation of benefits",
  other: "Other",
} satisfies Record<(typeof documentTypes)[number], string>;

export const claimDocumentTypes = [
  "claim_record",
  "explanation_of_benefits",
] as const;

export type ClaimDocumentType = (typeof claimDocumentTypes)[number];

export function isClaimDocumentType(type: DocumentType): boolean {
  return claimDocumentTypes.includes(type as ClaimDocumentType);
}

export const documentMetadataSchema = z.object({
  title: z.string().trim().min(1).max(160),
  type: z.enum(documentTypes),
  claimId: z.string().uuid().nullable().optional(),
});

export function validateDocumentClaimLink(
  type: DocumentType,
  claimId: string | null | undefined,
): string | null {
  if (!claimId) return null;
  if (!isClaimDocumentType(type)) {
    return "Only claim records and explanations of benefits can be linked to a claim.";
  }
  return null;
}

export const maxDocumentBytes = 25 * 1024 * 1024;

export type DocumentType = (typeof documentTypes)[number];

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
