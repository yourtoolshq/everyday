import { TRPCError } from "@trpc/server";

import {
  craReferenceErrorResponse,
  parseUpdateCraReferenceDocumentForm,
} from "~/server/api/cra-reference-http";
import {
  deleteCraReferenceDocument,
  updateCraReferenceDocument,
} from "~/server/api/cra-reference-values";
import { db } from "~/server/db";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid document ID.",
      });
    }
    const { input, attachmentAction } =
      await parseUpdateCraReferenceDocumentForm(await request.formData());
    const document = await updateCraReferenceDocument(
      db,
      id,
      input,
      attachmentAction,
    );
    return Response.json({ document });
  } catch (error) {
    return craReferenceErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid document ID.",
      });
    }
    await deleteCraReferenceDocument(db, id);
    return Response.json({ success: true });
  } catch (error) {
    return craReferenceErrorResponse(error);
  }
}
