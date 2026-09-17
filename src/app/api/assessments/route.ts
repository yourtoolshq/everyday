import { createAssessment } from "~/server/api/filing-values";
import {
  filingErrorResponse,
  parseAssessmentForm,
} from "~/server/api/filing-http";
import { db } from "~/server/db";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const filingId = Number(form.get("filingId"));
    if (!Number.isSafeInteger(filingId) || filingId <= 0) {
      return Response.json({ error: "Choose a filing." }, { status: 400 });
    }
    const parsed = await parseAssessmentForm(form);
    const assessment = await createAssessment(
      db,
      filingId,
      parsed.input,
      parsed.attachment ?? null,
    );
    return Response.json({ assessment }, { status: 201 });
  } catch (error) {
    return filingErrorResponse(error);
  }
}
