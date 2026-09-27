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
