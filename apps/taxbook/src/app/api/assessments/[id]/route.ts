import { TRPCError } from "@trpc/server";

import {
  filingErrorResponse,
  parseAssessmentForm,
} from "~/server/api/filing-http";
import { deleteAssessment, updateAssessment } from "~/server/api/filing-values";
import { db } from "~/server/db";

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid assessment ID.",
    });
  }
  return id;
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await context.params).id);
    const parsed = await parseAssessmentForm(await request.formData());
    const assessment = await updateAssessment(
      db,
      id,
      parsed.input,
      parsed.attachmentAction,
    );
    return Response.json({ assessment });
  } catch (error) {
    return filingErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await context.params).id);
    const result = await deleteAssessment(db, id);
    return Response.json(result);
  } catch (error) {
    return filingErrorResponse(error);
  }
}
