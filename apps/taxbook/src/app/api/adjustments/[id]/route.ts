import { TRPCError } from "@trpc/server";

import {
  deleteAdjustment,
  updateAdjustment,
} from "~/server/api/filing-values";
import {
  filingErrorResponse,
  parseUpdateAdjustmentForm,
} from "~/server/api/filing-http";
import { db } from "~/server/db";

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid adjustment ID." });
  }
  return id;
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await context.params).id);
    const { input, attachmentAction } = await parseUpdateAdjustmentForm(
      await request.formData(),
    );
    const adjustment = await updateAdjustment(db, id, input, attachmentAction);
    return Response.json({ adjustment });
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
    const result = await deleteAdjustment(db, id);
    return Response.json(result);
  } catch (error) {
    return filingErrorResponse(error);
  }
}
