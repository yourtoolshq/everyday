/** Omitted date preserves the stored value; explicit null clears it. */
export function resolveUpdatedDocumentDate(
  existingDocumentDate: string | null,
  inputDocumentDate: string | null | undefined,
): string | null {
  if (inputDocumentDate === undefined) return existingDocumentDate;
  return inputDocumentDate ?? null;
}
