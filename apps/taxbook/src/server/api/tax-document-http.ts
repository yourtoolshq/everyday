import { TRPCError } from "@trpc/server";
import { Buffer } from "node:buffer";
import { z } from "zod";

import {
  allowedTaxDocumentAttachmentTypes,
  MAX_TAX_DOCUMENT_ATTACHMENT_BYTES,
  taxDocumentInput,
  taxDocumentUpdateInput,
  type TaxDocumentAttachmentAction,
  type TaxDocumentAttachmentInput,
} from "~/domain/tax-document";

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
  if (entry.size > MAX_TAX_DOCUMENT_ATTACHMENT_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "Attachment must be 20 MB or smaller.",
    });
  }
  if (!allowedTaxDocumentAttachmentTypes.includes(entry.type as never)) {
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
    mimeType: entry.type as TaxDocumentAttachmentInput["mimeType"],
    sizeBytes: entry.size,
    data: Buffer.from(await entry.arrayBuffer()),
  } satisfies TaxDocumentAttachmentInput;
}

function commonFields(form: FormData) {
  const person = nullableText(form, "personId");
  const type = textValue(form, "type");
  return {
    type,
    customTypeName: type === "other" ? nullableText(form, "customTypeName") : null,
    issuer: textValue(form, "issuer"),
    personId: person === null ? null : Number(person),
    notes: nullableText(form, "notes"),
  };
}

export async function parseCreateTaxDocumentForm(form: FormData) {
  const input = taxDocumentInput.parse({
    taxItemId: positiveInteger(form, "taxItemId"),
    ...commonFields(form),
  });
  return { input, attachment: await attachmentFromForm(form) };
}

export async function parseUpdateTaxDocumentForm(form: FormData) {
  const input = taxDocumentUpdateInput.parse({
    ...commonFields(form),
    status: textValue(form, "status"),
  });
  const action = textValue(form, "attachmentAction") || "keep";
  if (action === "keep") {
    return {
      input,
      attachmentAction: { type: "keep" } as TaxDocumentAttachmentAction,
    };
  }
  if (action === "remove") {
    return {
      input,
      attachmentAction: { type: "remove" } as TaxDocumentAttachmentAction,
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
      message: "Choose an attachment to upload.",
    });
  }
  return {
    input,
    attachmentAction: {
      type: "replace",
      attachment,
    } as TaxDocumentAttachmentAction,
  };
}

const statusByCode: Partial<Record<TRPCError["code"], number>> = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
};

export function taxDocumentErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return Response.json(
      { error: error.issues[0]?.message ?? "Check the Tax Document details." },
      { status: 400 },
    );
  }
  if (error instanceof TRPCError) {
    return Response.json(
      { error: error.message },
      { status: statusByCode[error.code] ?? 500 },
    );
  }
  console.error("Tax Document request failed", error);
  return Response.json(
    { error: "Unable to save the Tax Document." },
    { status: 500 },
  );
}
