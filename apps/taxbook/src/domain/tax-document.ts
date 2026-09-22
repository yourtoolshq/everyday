import { z } from "zod";
import type { Buffer } from "node:buffer";

export const taxDocumentTypes = [
  "t4",
  "t5",
  "rrsp_contribution_receipt",
  "fhsa_tax_document",
  "other",
] as const;

export const taxDocumentStatuses = [
  "expected",
  "received",
  "ready",
  "used",
] as const;

export type TaxDocumentType = (typeof taxDocumentTypes)[number];
export type TaxDocumentStatus = (typeof taxDocumentStatuses)[number];

export const taxDocumentTypeLabels: Record<TaxDocumentType, string> = {
  t4: "T4",
  t5: "T5",
  rrsp_contribution_receipt: "RRSP contribution receipt",
  fhsa_tax_document: "FHSA tax document",
  other: "Other",
};

export const taxDocumentStatusLabels: Record<TaxDocumentStatus, string> = {
  expected: "Expected",
  received: "Received",
  ready: "Ready to file",
  used: "Used for filing",
};

export const allowedTaxDocumentAttachmentTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
] as const;

export const MAX_TAX_DOCUMENT_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const commonInput = z
  .object({
    type: z.enum(taxDocumentTypes),
    customTypeName: z.string().trim().max(100).nullable(),
    issuer: z.string().trim().min(1).max(200),
    personId: z.number().int().positive().nullable(),
    notes: z.string().trim().max(4000).nullable(),
  })
  .superRefine((value, context) => {
    if (value.type === "other" && !value.customTypeName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customTypeName"],
        message: "Enter a document type.",
      });
    }
    if (value.type !== "other" && value.customTypeName !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customTypeName"],
        message: "A custom type is only valid for Other documents.",
      });
    }
  });

export const taxDocumentInput = z.intersection(
  commonInput,
  z.object({ taxItemId: z.number().int().positive() }),
);

export const taxDocumentUpdateInput = z.intersection(
  commonInput,
  z.object({ status: z.enum(taxDocumentStatuses) }),
);

export type TaxDocumentInput = z.infer<typeof taxDocumentInput>;
export type TaxDocumentUpdateInput = z.infer<typeof taxDocumentUpdateInput>;

export type TaxDocumentAttachmentInput = {
  fileName: string;
  mimeType: (typeof allowedTaxDocumentAttachmentTypes)[number];
  sizeBytes: number;
  data: Buffer;
};

export type TaxDocumentAttachmentAction =
  | { type: "keep" }
  | { type: "remove" }
  | { type: "replace"; attachment: TaxDocumentAttachmentInput };

export type TaxDocumentReadiness = {
  total: number;
  counts: Record<TaxDocumentStatus, number>;
  isReady: boolean;
};

export function buildTaxDocumentReadiness(
  documents: ReadonlyArray<{ status: TaxDocumentStatus }>,
): TaxDocumentReadiness {
  const counts: Record<TaxDocumentStatus, number> = {
    expected: 0,
    received: 0,
    ready: 0,
    used: 0,
  };
  for (const document of documents) counts[document.status] += 1;
  return {
    total: documents.length,
    counts,
    isReady:
      documents.length > 0 && counts.expected === 0 && counts.received === 0,
  };
}

export function taxDocumentDisplayType(document: {
  type: TaxDocumentType;
  customTypeName: string | null;
}) {
  return document.type === "other"
    ? (document.customTypeName ?? taxDocumentTypeLabels.other)
    : taxDocumentTypeLabels[document.type];
}
