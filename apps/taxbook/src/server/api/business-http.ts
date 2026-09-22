import { TRPCError } from "@trpc/server";
import { Buffer } from "node:buffer";
import { z } from "zod";
import { allowedAttachmentTypes, MAX_ATTACHMENT_BYTES, type AttachmentAction, type AttachmentInput } from "~/domain/record";
import { businessRecordInput, businessRecordUpdateInput } from "~/domain/self-employment";

const textValue = (form: FormData, name: string) => { const value = form.get(name); return typeof value === "string" ? value : ""; };
const nullableText = (form: FormData, name: string) => textValue(form, name).trim() || null;
const positiveInteger = (form: FormData, name: string) => { const value = Number(textValue(form, name)); return Number.isSafeInteger(value) ? value : Number.NaN; };
async function attachmentFromForm(form: FormData) {
  const entry = form.get("attachment"); if (!(entry instanceof File) || entry.size === 0) return null;
  if (entry.size > MAX_ATTACHMENT_BYTES) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Attachment must be 20 MB or smaller." });
  if (!allowedAttachmentTypes.includes(entry.type as never)) throw new TRPCError({ code: "BAD_REQUEST", message: "Use a PDF, JPEG, PNG, HEIC, or HEIF attachment." });
  const fileName = entry.name.split(/[\\/]/).pop()?.trim() || "attachment"; if (fileName.length > 255) throw new TRPCError({ code: "BAD_REQUEST", message: "Attachment filename must be 255 characters or fewer." });
  return { fileName, mimeType: entry.type as AttachmentInput["mimeType"], sizeBytes: entry.size, data: Buffer.from(await entry.arrayBuffer()) } satisfies AttachmentInput;
}
const common = (form: FormData) => ({ kind: textValue(form, "kind"), expenseCategory: nullableText(form, "expenseCategory"), date: textValue(form, "date"), description: textValue(form, "description"), amountCents: positiveInteger(form, "amountCents"), notes: nullableText(form, "notes") });
export async function parseCreateBusinessRecord(form: FormData) { return { input: businessRecordInput.parse({ businessActivityId: positiveInteger(form, "businessActivityId"), ...common(form) }), attachment: await attachmentFromForm(form) }; }
export async function parseUpdateBusinessRecord(form: FormData) {
  const input = businessRecordUpdateInput.parse(common(form)); const action = textValue(form, "attachmentAction") || "keep";
  if (action === "keep" || action === "remove") return { input, attachmentAction: { type: action } as AttachmentAction };
  if (action !== "replace") throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid attachment action." });
  const attachment = await attachmentFromForm(form); if (!attachment) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an attachment to upload." });
  return { input, attachmentAction: { type: "replace", attachment } as AttachmentAction };
}
export function businessErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Check the Record details." }, { status: 400 });
  if (error instanceof TRPCError) return Response.json({ error: error.message }, { status: ({ BAD_REQUEST: 400, NOT_FOUND: 404, CONFLICT: 409, PAYLOAD_TOO_LARGE: 413 } as Record<string, number>)[error.code] ?? 500 });
  console.error("Self-employment request failed", error); return Response.json({ error: "Unable to save the Record." }, { status: 500 });
}
