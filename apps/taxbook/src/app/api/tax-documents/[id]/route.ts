import { TRPCError } from "@trpc/server";

import {
  deleteTaxDocument,
  updateTaxDocument,
} from "~/server/api/tax-document-values";
import {
  parseUpdateTaxDocumentForm,
  taxDocumentErrorResponse,
} from "~/server/api/tax-document-http";
import { db } from "~/server/db";

function taxDocumentId(value: string) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid Tax Document ID.",
    });
  }
  return id;
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = taxDocumentId((await context.params).id);
    const { input, attachmentAction } = await parseUpdateTaxDocumentForm(
      await request.formData(),
    );
    const document = await updateTaxDocument(
      db,
      id,
      input,
      attachmentAction,
    );
    return Response.json({ document });
  } catch (error) {
    return taxDocumentErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(
      await deleteTaxDocument(db, taxDocumentId((await context.params).id)),
    );
  } catch (error) {
    return taxDocumentErrorResponse(error);
  }
}
