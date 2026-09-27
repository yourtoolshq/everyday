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

export type DocumentType = (typeof documentTypes)[number];

export const documentAccept =
  "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif";

export function titleFromFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "").trim();
  return (withoutExtension || filename.trim() || "Document").slice(0, 160);
}

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
