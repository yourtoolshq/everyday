import { createTaxDocument } from "~/server/api/tax-document-values";
import {
  parseCreateTaxDocumentForm,
  taxDocumentErrorResponse,
} from "~/server/api/tax-document-http";
import { db } from "~/server/db";

export async function POST(request: Request) {
  try {
    const { input, attachment } = await parseCreateTaxDocumentForm(
      await request.formData(),
    );
    const document = await createTaxDocument(db, input, attachment);
    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return taxDocumentErrorResponse(error);
  }
}
