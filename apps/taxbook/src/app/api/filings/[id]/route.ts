import { TRPCError } from "@trpc/server";

import {
  deleteOriginalReturn,
  updateOriginalReturn,
} from "~/server/api/filing-values";
import {
  filingErrorResponse,
  parseUpdateOriginalReturnForm,
} from "~/server/api/filing-http";
import { db } from "~/server/db";

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid filing ID." });
  }
  return id;
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await context.params).id);
    const { input, attachmentAction } = await parseUpdateOriginalReturnForm(
      await request.formData(),
    );
    const filing = await updateOriginalReturn(db, id, input, attachmentAction);
    return Response.json({ filing });
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
    const result = await deleteOriginalReturn(db, id);
    return Response.json(result);
  } catch (error) {
    return filingErrorResponse(error);
  }
}
