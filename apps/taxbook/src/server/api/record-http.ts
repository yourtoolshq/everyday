import { TRPCError } from "@trpc/server";
import { Buffer } from "node:buffer";
import { z } from "zod";

import {
  allowedAttachmentTypes,
  MAX_ATTACHMENT_BYTES,
  recordInput,
  recordUpdateInput,
  type AttachmentAction,
  type AttachmentInput,
} from "~/domain/record";

function textValue(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function nullableText(form: FormData, name: string) {
  const value = textValue(form, name).trim();
  return value || null;
}

function positiveInteger(form: FormData, name: string) {
  const value = Number(textValue(form, name));
  return Number.isSafeInteger(value) ? value : Number.NaN;
}

async function attachmentFromForm(form: FormData) {
  const entry = form.get("attachment");
  if (!(entry instanceof File) || entry.size === 0) return null;
  if (entry.size > MAX_ATTACHMENT_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "Attachment must be 20 MB or smaller.",
    });
  }
  if (!allowedAttachmentTypes.includes(entry.type as never)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Use a PDF, JPEG, PNG, HEIC, or HEIF attachment.",
    });
  }
  const fileName = entry.name.split(/[\\/]/).pop()?.trim() || "attachment";
  if (fileName.length > 255) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Attachment filename must be 255 characters or fewer.",
    });
  }
  return {
    fileName,
    mimeType: entry.type as AttachmentInput["mimeType"],
    sizeBytes: entry.size,
    data: Buffer.from(await entry.arrayBuffer()),
  } satisfies AttachmentInput;
}

function commonFields(form: FormData) {
  const person = nullableText(form, "personId");
  return {
    date: textValue(form, "date"),
    description: textValue(form, "description"),
    amountCents: positiveInteger(form, "amountCents"),
    personId: person === null ? null : Number(person),
    notes: nullableText(form, "notes"),
  };
}

export async function parseCreateRecordForm(form: FormData) {
  const input = recordInput.parse({
    taxItemId: positiveInteger(form, "taxItemId"),
    ...commonFields(form),
    confirmReplaceActual: textValue(form, "confirmReplaceActual") === "true",
  });
  return { input, attachment: await attachmentFromForm(form) };
}

export async function parseUpdateRecordForm(form: FormData) {
  const input = recordUpdateInput.parse(commonFields(form));
  const action = textValue(form, "attachmentAction") || "keep";
  if (action === "keep") {
    return { input, attachmentAction: { type: "keep" } as AttachmentAction };
  }
  if (action === "remove") {
    return { input, attachmentAction: { type: "remove" } as AttachmentAction };
  }
  if (action !== "replace") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid attachment action." });
  }
  const attachment = await attachmentFromForm(form);
  if (!attachment) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an attachment to upload." });
  }
  return {
    input,
    attachmentAction: { type: "replace", attachment } as AttachmentAction,
  };
}

const statusByCode: Partial<Record<TRPCError["code"], number>> = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
};

export function recordErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return Response.json(
      { error: error.issues[0]?.message ?? "Check the Record details." },
      { status: 400 },
    );
  }
  if (error instanceof TRPCError) {
    return Response.json(
      { error: error.message },
      { status: statusByCode[error.code] ?? 500 },
    );
  }
  console.error("Record request failed", error);
  return Response.json({ error: "Unable to save the Record." }, { status: 500 });
}
