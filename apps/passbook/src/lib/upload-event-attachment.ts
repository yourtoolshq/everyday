import type { AccountDocumentType } from "~/lib/documents";

type UploadEventAttachmentInput = {
  accountId: string;
  eventId: string;
  termsSnapshotId?: string | null;
  file: File;
  title?: string;
  type?: AccountDocumentType;
  documentDate?: string | null;
  notes?: string;
};

export async function uploadEventAttachment(input: UploadEventAttachmentInput) {
  const form = new FormData();
  form.append("file", input.file);
  form.append("type", input.type ?? "financial_correspondence");
  form.append("eventId", input.eventId);
  if (input.title?.trim()) form.append("title", input.title.trim());
  if (input.documentDate?.trim()) form.append("documentDate", input.documentDate.trim());
  if (input.notes?.trim()) form.append("notes", input.notes.trim());
  if (input.termsSnapshotId) form.append("termsSnapshotId", input.termsSnapshotId);

  const response = await fetch(`/api/accounts/${input.accountId}/documents`, {
    method: "POST",
    body: form,
  });

  const data = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "The document could not be uploaded.");
  }

  return data;
}
