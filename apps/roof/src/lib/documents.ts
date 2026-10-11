import { z } from "zod";

import { calendarDateSchema } from "~/lib/dates";

export const documentTypes = [
  "lease",
  "notice",
  "agreement",
  "receipt",
  "drawing",
  "correspondence",
  "photo",
  "insurance",
  "other",
] as const;

export type DocumentType = (typeof documentTypes)[number];

export const documentTypeLabels = {
  lease: "Lease",
  notice: "Notice",
  agreement: "Agreement",
  receipt: "Receipt",
  drawing: "Drawing or plan",
  correspondence: "Correspondence",
  photo: "Photo",
  insurance: "Insurance",
  other: "Other",
} satisfies Record<DocumentType, string>;

export const documentMetadataSchema = z.object({
  title: z.string().trim().min(1).max(160),
  type: z.enum(documentTypes),
  documentDate: calendarDateSchema.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  insuranceId: z.string().uuid().nullable().optional(),
  eventId: z.string().uuid().nullable().optional(),
});

export const documentAccept =
  "application/pdf,image/jpeg,image/png,image/webp,image/heic,message/rfc822,.pdf,.jpg,.jpeg,.png,.webp,.heic,.eml";

export function titleFromFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "").trim();
  return (withoutExtension || filename.trim() || "Document").slice(0, 160);
}

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export { formatDateLabel } from "~/lib/properties";
