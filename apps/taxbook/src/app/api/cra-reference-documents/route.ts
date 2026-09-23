import {
  craReferenceErrorResponse,
  parseCreateCraReferenceDocumentForm,
} from "~/server/api/cra-reference-http";
import { createCraReferenceDocument } from "~/server/api/cra-reference-values";
import { db } from "~/server/db";

export async function POST(request: Request) {
  try {
    const { input, attachment } = await parseCreateCraReferenceDocumentForm(
      await request.formData(),
    );
    const document = await createCraReferenceDocument(db, input, attachment);
    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return craReferenceErrorResponse(error);
  }
}
