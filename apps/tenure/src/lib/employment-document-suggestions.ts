import type { CompensationChangeRecord } from "~/lib/compensation";
import type { DocumentType } from "~/lib/documents";
import { formatCompensationRate } from "~/lib/compensation";
import { documentTypeLabels, formatDateLabel } from "~/lib/documents";

export type RequiredDocumentKind = "offer_letter" | "compensation_change";

function joinTitleParts(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .slice(0, 160);
}

export function suggestRequiredDocumentType(
  kind: RequiredDocumentKind,
): DocumentType {
  if (kind === "offer_letter") return "offer_letter";
  return "salary_letter";
}

export function suggestRequiredDocumentDate(input: {
  kind: RequiredDocumentKind;
  compensationChange?: CompensationChangeRecord | null;
}): string {
  if (input.kind === "compensation_change") {
    return input.compensationChange?.effectiveDate ?? "";
  }
  return "";
}

export function suggestRequiredDocumentTitle(input: {
  kind: RequiredDocumentKind;
  employerName: string;
  personName?: string | null;
  documentDate?: string | null;
  compensationChange?: CompensationChangeRecord | null;
}): string {
  const employer = input.employerName.trim() || "Employer";
  const datePart =
    formatDateLabel(input.documentDate) ?? input.documentDate?.trim() ?? null;

  if (input.kind === "offer_letter") {
    return joinTitleParts(
      datePart,
      employer,
      input.personName,
      documentTypeLabels.offer_letter,
    );
  }

  if (input.compensationChange) {
    const rate = formatCompensationRate(input.compensationChange);
    return joinTitleParts(datePart, employer, rate, "Supporting document");
  }

  return joinTitleParts(datePart, employer, "Supporting document");
}

export function canSuggestRequiredDocumentTitle(input: {
  file: File | null;
  documentDate: string;
}): boolean {
  return Boolean(input.file && input.documentDate.trim());
}
