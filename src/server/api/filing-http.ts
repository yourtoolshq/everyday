import { TRPCError } from "@trpc/server";
import { Buffer } from "node:buffer";
import { z } from "zod";

import {
  allowedFilingAttachmentTypes,
  assessmentInput,
  MAX_FILING_ATTACHMENT_BYTES,
  originalReturnInput,
  originalReturnUpdateInput,
  type FilingAttachmentAction,
  type FilingAttachmentInput,
} from "~/domain/filing";

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
  if (entry.size > MAX_FILING_ATTACHMENT_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "Attachment must be 20 MB or smaller.",
    });
  }
  if (!allowedFilingAttachmentTypes.includes(entry.type as never)) {
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
    mimeType: entry.type as FilingAttachmentInput["mimeType"],
    sizeBytes: entry.size,
    data: Buffer.from(await entry.arrayBuffer()),
  } satisfies FilingAttachmentInput;
}

function nullableSignedResultCents(form: FormData, name: string) {
  const value = textValue(form, name).trim();
  if (value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Enter a valid refund or amount owing, or choose Unknown.",
    });
  }
  return parsed;
}

function originalReturnCreateFields(form: FormData) {
  return {
    personId: positiveInteger(form, "personId"),
    submissionDate: nullableText(form, "submissionDate"),
    expectedResultCents: nullableSignedResultCents(form, "expectedResultCents"),
    returnCopyStatus: textValue(form, "returnCopyStatus"),
    notes: nullableText(form, "notes"),
  };
}

function originalReturnUpdateFields(form: FormData) {
  return {
    submissionDate: nullableText(form, "submissionDate"),
    expectedResultCents: nullableSignedResultCents(form, "expectedResultCents"),
    returnCopyStatus: textValue(form, "returnCopyStatus"),
    notes: nullableText(form, "notes"),
  };
}

export async function parseCreateOriginalReturnForm(form: FormData) {
  const input = originalReturnInput.parse(originalReturnCreateFields(form));
  return { input, attachment: await attachmentFromForm(form) };
}

export async function parseUpdateOriginalReturnForm(form: FormData) {
  const input = originalReturnUpdateInput.parse({
    ...originalReturnUpdateFields(form),
    status: textValue(form, "status"),
  });
  const action = textValue(form, "attachmentAction") || "keep";
  if (action === "keep") {
    return {
      input,
      attachmentAction: { type: "keep" } as FilingAttachmentAction,
    };
  }
  if (action === "unavailable") {
    return {
      input,
      attachmentAction: { type: "unavailable" } as FilingAttachmentAction,
    };
  }
  if (action === "remove") {
    return {
      input,
      attachmentAction: { type: "remove" } as FilingAttachmentAction,
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
    } as FilingAttachmentAction,
  };
}

export async function parseAssessmentForm(form: FormData) {
  const input = assessmentInput.parse({
    assessmentDate: textValue(form, "assessmentDate"),
    assessedResultCents: nullableSignedResultCents(form, "assessedResultCents"),
    refundOrPaymentDate: nullableText(form, "refundOrPaymentDate"),
    notes: nullableText(form, "notes"),
  });
  const action = textValue(form, "attachmentAction") || "replace";
  if (action === "keep") {
    return {
      input,
      attachmentAction: { type: "keep" } as FilingAttachmentAction,
    };
  }
  if (action === "remove") {
    return {
      input,
      attachmentAction: { type: "remove" } as FilingAttachmentAction,
    };
  }
  const attachment = await attachmentFromForm(form);
  if (!attachment) {
    return {
      input,
      attachment: null as FilingAttachmentInput | null,
      attachmentAction: { type: "keep" } as FilingAttachmentAction,
    };
  }
  return {
    input,
    attachment,
    attachmentAction: {
      type: "replace",
      attachment,
    } as FilingAttachmentAction,
  };
}

const statusByCode: Partial<Record<TRPCError["code"], number>> = {
  BAD_REQUEST: 400,
  CONFLICT: 409,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
};

const filingFieldMessages: Partial<Record<string, string>> = {
  personId: "Choose a household member.",
  expectedResultCents:
    "Enter a valid expected refund or amount owing, or choose Unknown.",
  assessedResultCents:
    "Enter a valid assessed refund or amount owing, or choose Unknown.",
  submissionDate: "Use a filing date in YYYY-MM-DD format.",
  assessmentDate: "Use an assessment date in YYYY-MM-DD format.",
  returnCopyStatus:
    "Choose whether the submitted T1 is attached or unavailable.",
  status: "Choose a filing status.",
};

function filingValidationMessage(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Check the filing details.";
  const field = issue.path[0];
  if (typeof field === "string" && issue.code !== "custom") {
    return filingFieldMessages[field] ?? issue.message;
  }
  return issue.message;
}

export function filingErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return Response.json(
      { error: filingValidationMessage(error) },
      { status: 400 },
    );
  }
  if (error instanceof TRPCError) {
    return Response.json(
      { error: error.message },
      { status: statusByCode[error.code] ?? 500 },
    );
  }
  console.error("Filing request failed", error);
  return Response.json(
    { error: "Unable to save the filing." },
    { status: 500 },
  );
}
