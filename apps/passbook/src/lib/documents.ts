import { z } from "zod";

export const documentTypes = [
  "statement",
  "void_cheque",
  "notice",
  "agreement",
  "opening_document",
  "closure_document",
  "card_letter",
  "financial_correspondence",
  "other",
] as const;

export type DocumentType = (typeof documentTypes)[number];

export const accountDocumentTypes = documentTypes.filter(
  (type) => type !== "statement",
);

export type AccountDocumentType = (typeof accountDocumentTypes)[number];

export const documentTypeLabels = {
  statement: "Statement",
  void_cheque: "Void cheque",
  notice: "Notice",
  agreement: "Agreement",
  opening_document: "Opening document",
  closure_document: "Closure document",
  card_letter: "Card letter",
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

export function isEmlMimeType(mimeType: string) {
  return mimeType === "message/rfc822";
}

export function titleFromFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "").trim();
  return (withoutExtension || filename.trim() || "Document").slice(0, 160);
}

function documentDateYearMonth(documentDate: string | null | undefined) {
  const match = /^(\d{4}-\d{2})/.exec(documentDate?.trim() ?? "");
  return match?.[1] ?? null;
}

function joinTitleParts(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .slice(0, 160);
}

export function suggestDocumentTitle(input: {
  type: DocumentType;
  accountDisplayName: string;
  periodKey?: string | null;
  documentDate?: string | null;
}) {
  const accountName = input.accountDisplayName.trim() || "Account";
  const typeLabel = documentTypeLabels[input.type];

  if (input.type === "statement") {
    return joinTitleParts(input.periodKey, accountName, typeLabel);
  }

  if (input.type === "void_cheque") {
    return joinTitleParts(accountName, typeLabel);
  }

  return joinTitleParts(
    documentDateYearMonth(input.documentDate),
    accountName,
    typeLabel,
  );
}

export function usesSuggestedDocumentTitle(type: DocumentType) {
  return type === "statement" || type === "void_cheque";
}

export function defaultDocumentTitle(input: {
  type: DocumentType;
  accountDisplayName: string;
  periodKey?: string | null;
  documentDate?: string | null;
  filename?: string;
}) {
  if (usesSuggestedDocumentTitle(input.type)) {
    return suggestDocumentTitle(input);
  }

  return titleFromFilename(input.filename ?? "");
}

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
