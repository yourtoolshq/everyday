import {
  filingErrorResponse,
  parseCreateOriginalReturnForm,
} from "~/server/api/filing-http";
import { createOriginalReturn } from "~/server/api/filing-values";
import { db } from "~/server/db";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const taxYearId = Number(form.get("taxYearId"));
    if (!Number.isSafeInteger(taxYearId) || taxYearId <= 0) {
      return Response.json({ error: "Choose a tax year." }, { status: 400 });
    }
    const { input, attachment } = await parseCreateOriginalReturnForm(form);
    const filing = await createOriginalReturn(db, taxYearId, input, attachment);
    return Response.json({ filing }, { status: 201 });
  } catch (error) {
    return filingErrorResponse(error);
  }
}
