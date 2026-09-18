type UploadStatementInput = {
  accountId: string;
  file: File;
  periodKey: string;
  title?: string;
  notes?: string;
};

export async function uploadStatement(input: UploadStatementInput) {
  const form = new FormData();
  form.append("file", input.file);
  form.append("type", "statement");
  form.append("periodKey", input.periodKey);
  if (input.title?.trim()) form.append("title", input.title.trim());
  if (input.notes?.trim()) form.append("notes", input.notes.trim());

  const response = await fetch(`/api/accounts/${input.accountId}/documents`, {
    method: "POST",
    body: form,
  });

  const data = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "The statement could not be uploaded.");
  }

  return data;
}
