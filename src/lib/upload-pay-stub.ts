export async function uploadPayStub(
  paycheckId: string,
  file: File,
  title?: string,
) {
  const form = new FormData();
  form.append("file", file);
  if (title?.trim()) form.append("title", title.trim());

  const response = await fetch(`/api/paychecks/${paycheckId}/stub`, {
    method: "POST",
    body: form,
  });

  const payload = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Pay stub upload failed.");
  }

  return payload;
}
