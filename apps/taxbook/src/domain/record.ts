import { z } from "zod";
import type { Buffer } from "node:buffer";

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const allowedAttachmentTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
] as const;

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
export const recordDate = z
  .string()
  .regex(isoDatePattern, "Enter a valid date.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day));
    return date.toISOString().slice(0, 10) === value;
  }, "Enter a valid date.");

export const recordInput = z.object({
  taxItemId: z.number().int().positive(),
  date: recordDate,
  description: z.string().trim().min(1).max(200),
  amountCents: z.number().int().positive(),
  personId: z.number().int().positive().nullable(),
  notes: z.string().trim().max(4000).nullable(),
  confirmReplaceActual: z.boolean().default(false),
});

export const recordUpdateInput = recordInput.omit({
  taxItemId: true,
  confirmReplaceActual: true,
});

export type RecordInput = z.infer<typeof recordInput>;
export type RecordUpdateInput = z.infer<typeof recordUpdateInput>;
export type AttachmentInput = {
  fileName: string;
  mimeType: (typeof allowedAttachmentTypes)[number];
  sizeBytes: number;
  data: Buffer;
};
export type AttachmentAction =
  | { type: "keep" }
  | { type: "remove" }
  | { type: "replace"; attachment: AttachmentInput };
