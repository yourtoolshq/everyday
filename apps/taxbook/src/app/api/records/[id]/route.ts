import { TRPCError } from "@trpc/server";

import { deleteRecord, updateRecord } from "~/server/api/record-values";
import {
  parseUpdateRecordForm,
  recordErrorResponse,
} from "~/server/api/record-http";
import { db } from "~/server/db";

function recordId(value: string) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid Record ID." });
  }
  return id;
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = recordId((await context.params).id);
    const { input, attachmentAction } = await parseUpdateRecordForm(
      await request.formData(),
    );
    const record = await updateRecord(db, id, input, attachmentAction);
    return Response.json({ record });
  } catch (error) {
    return recordErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(await deleteRecord(db, recordId((await context.params).id)));
  } catch (error) {
    return recordErrorResponse(error);
  }
}
