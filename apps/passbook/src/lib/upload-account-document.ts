import type { AccountDocumentType } from "~/lib/documents";

type UploadAccountDocumentInput = {
  accountId: string;
  file: File;
  type: AccountDocumentType;
  title?: string;
  documentDate?: string | null;
  notes?: string;
};

export async function uploadAccountDocument(input: UploadAccountDocumentInput) {
  const form = new FormData();
  form.append("file", input.file);
  form.append("type", input.type);
  if (input.title?.trim()) form.append("title", input.title.trim());
  if (input.documentDate?.trim()) form.append("documentDate", input.documentDate.trim());
  if (input.notes?.trim()) form.append("notes", input.notes.trim());

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
