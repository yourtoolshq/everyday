import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { isAppError } from "@yourtoolshq/server/errors";

import type { AttachmentAction } from "~/domain/record";
import { taxbookLog } from "~/core/infrastructure/logger";
import { appErrorHttpStatus } from "~/core/infrastructure/trpc-errors";
import { recordInput, recordUpdateInput } from "~/domain/record";
import { stageAttachment } from "~/server/api/upload";

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
  return stageAttachment(form);
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
  if (isAppError(error)) {
    return Response.json(
      { error: error.message },
      { status: appErrorHttpStatus(error) ?? 500 },
    );
  }
  if (error instanceof TRPCError) {
    return Response.json(
      { error: error.message },
      { status: statusByCode[error.code] ?? 500 },
    );
  }
  taxbookLog.error("record.http", {
    outcome: "failure",
    message: error instanceof Error ? error.message : "unknown",
  });
  return Response.json(
    { error: "Unable to save the Record." },
    { status: 500 },
  );
}
