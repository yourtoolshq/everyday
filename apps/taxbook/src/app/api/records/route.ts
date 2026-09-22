import { createRecord } from "~/server/api/record-values";
import {
  parseCreateRecordForm,
  recordErrorResponse,
} from "~/server/api/record-http";
import { db } from "~/server/db";

export async function POST(request: Request) {
  try {
    const { input, attachment } = await parseCreateRecordForm(
      await request.formData(),
    );
    const record = await createRecord(db, input, attachment);
    return Response.json({ record }, { status: 201 });
  } catch (error) {
    return recordErrorResponse(error);
  }
}
