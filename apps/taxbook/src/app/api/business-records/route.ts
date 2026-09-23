import {
  businessErrorResponse,
  parseCreateBusinessRecord,
} from "~/server/api/business-http";
import { createBusinessRecord } from "~/server/api/business-values";
import { db } from "~/server/db";

export async function POST(request: Request) {
  try {
    const parsed = await parseCreateBusinessRecord(await request.formData());
    return Response.json(
      {
        record: await createBusinessRecord(db, parsed.input, parsed.attachment),
      },
      { status: 201 },
    );
  } catch (error) {
    return businessErrorResponse(error);
  }
}
