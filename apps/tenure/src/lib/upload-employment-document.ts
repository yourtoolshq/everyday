import type { DocumentType } from "~/lib/documents";

type UploadEmploymentDocumentInput = {
  employmentId: string;
  file: File;
  type: DocumentType;
  title?: string;
  documentDate?: string | null;
  notes?: string;
  discussionId?: string | null;
};

export async function uploadEmploymentDocument(
  input: UploadEmploymentDocumentInput,
) {
  const form = new FormData();
  form.append("file", input.file);
  form.append("type", input.type);
  if (input.title?.trim()) form.append("title", input.title.trim());
  if (input.documentDate?.trim())
    form.append("documentDate", input.documentDate.trim());
  if (input.notes?.trim()) form.append("notes", input.notes.trim());
  if (input.discussionId) form.append("discussionId", input.discussionId);

  const response = await fetch(
    `/api/employments/${input.employmentId}/documents`,
    {
      method: "POST",
      body: form,
    },
  );

  const data = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "The document could not be uploaded.");
  }

  return data;
}
