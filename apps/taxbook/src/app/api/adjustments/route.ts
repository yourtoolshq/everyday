import {
  filingErrorResponse,
  parseCreateAdjustmentForm,
} from "~/server/api/filing-http";
import { createAdjustment } from "~/server/api/filing-values";
import { db } from "~/server/db";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const taxYearId = Number(form.get("taxYearId"));
    if (!Number.isSafeInteger(taxYearId) || taxYearId <= 0) {
      return Response.json({ error: "Choose a tax year." }, { status: 400 });
    }
    const { input, attachment } = await parseCreateAdjustmentForm(form);
    const adjustment = await createAdjustment(db, taxYearId, input, attachment);
    return Response.json({ adjustment }, { status: 201 });
  } catch (error) {
    return filingErrorResponse(error);
  }
}
