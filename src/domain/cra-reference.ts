import { z } from "zod";
import type { Buffer } from "node:buffer";

export const craReferenceCategories = [
  "gst_hst_return",
  "canada_carbon_rebate",
  "other_cra_document",
] as const;

export type CraReferenceCategory = (typeof craReferenceCategories)[number];

export const craReferenceCategoryLabels: Record<CraReferenceCategory, string> = {
  gst_hst_return: "GST/HST Return",
  canada_carbon_rebate: "Canada Carbon Rebate",
  other_cra_document: "Other CRA Document",
};

export const allowedCraReferenceAttachmentTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
] as const;

export const MAX_CRA_REFERENCE_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export type CraReferenceAttachmentInput = {
  fileName: string;
  mimeType: (typeof allowedCraReferenceAttachmentTypes)[number];
  sizeBytes: number;
  data: Buffer;
};

export type CraReferenceAttachmentAction =
  | { type: "keep" }
  | { type: "remove" }
  | { type: "replace"; attachment: CraReferenceAttachmentInput };

export const craReferenceInput = z.object({
  taxYearId: z.number().int().positive(),
  category: z.enum(craReferenceCategories),
  title: z.string().trim().min(1, "Enter a title."),
  personId: z.number().int().positive().nullable(),
  documentDate: z.string().nullable(),
  reportingPeriodLabel: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
});

export const craReferenceUpdateInput = craReferenceInput.omit({ taxYearId: true });

export type CraReferenceInput = z.infer<typeof craReferenceInput>;
export type CraReferenceUpdateInput = z.infer<typeof craReferenceUpdateInput>;
