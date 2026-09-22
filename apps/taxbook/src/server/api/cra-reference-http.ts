import { Buffer } from "node:buffer";
import { TRPCError } from "@trpc/server";

import type {
  CraReferenceAttachmentAction,
  CraReferenceAttachmentInput,
} from "~/domain/cra-reference";
import {
  allowedCraReferenceAttachmentTypes,
  craReferenceInput,
  craReferenceUpdateInput,
  MAX_CRA_REFERENCE_ATTACHMENT_BYTES,
} from "~/domain/cra-reference";

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

function nullablePersonId(form: FormData) {
  const value = nullableText(form, "personId");
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
}

async function attachmentFromForm(form: FormData) {
  const entry = form.get("attachment");
  if (!(entry instanceof File) || entry.size === 0) return null;
  if (entry.size > MAX_CRA_REFERENCE_ATTACHMENT_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "Attachment must be 20 MB or smaller.",
    });
  }
  if (!allowedCraReferenceAttachmentTypes.includes(entry.type as never)) {
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
    mimeType: entry.type as CraReferenceAttachmentInput["mimeType"],
    sizeBytes: entry.size,
    data: Buffer.from(await entry.arrayBuffer()),
  } satisfies CraReferenceAttachmentInput;
}

function commonFields(form: FormData) {
  return {
    category: textValue(form, "category"),
    title: textValue(form, "title"),
    personId: nullablePersonId(form),
    documentDate: nullableText(form, "documentDate"),
    reportingPeriodLabel: nullableText(form, "reportingPeriodLabel"),
    notes: nullableText(form, "notes"),
  };
}

export async function parseCreateCraReferenceDocumentForm(form: FormData) {
  const input = craReferenceInput.parse({
    taxYearId: positiveInteger(form, "taxYearId"),
    ...commonFields(form),
  });
  return { input, attachment: await attachmentFromForm(form) };
}

export async function parseUpdateCraReferenceDocumentForm(form: FormData) {
  const input = craReferenceUpdateInput.parse(commonFields(form));
  const action = textValue(form, "attachmentAction") || "keep";
  if (action === "keep") {
    return {
      input,
      attachmentAction: { type: "keep" } as CraReferenceAttachmentAction,
    };
  }
  if (action === "remove") {
    return {
      input,
      attachmentAction: { type: "remove" } as CraReferenceAttachmentAction,
    };
  }
  if (action !== "replace") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid attachment action.",
    });
  }
  const attachment = await attachmentFromForm(form);
  if (!attachment) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Choose a replacement attachment.",
    });
  }
  return {
    input,
    attachmentAction: {
      type: "replace",
      attachment,
    } as CraReferenceAttachmentAction,
  };
}

export function craReferenceErrorResponse(error: unknown) {
  if (error instanceof TRPCError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "PAYLOAD_TOO_LARGE"
          ? 413
          : error.code === "CONFLICT"
            ? 409
            : 400;
    return Response.json({ error: error.message }, { status });
  }
  console.error(error);
  return Response.json(
    { error: "Unable to save the CRA reference document." },
    { status: 500 },
  );
}
