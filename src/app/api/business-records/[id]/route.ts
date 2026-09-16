import { deleteBusinessRecord, updateBusinessRecord } from "~/server/api/business-values";
import { businessErrorResponse, parseUpdateBusinessRecord } from "~/server/api/business-http";
import { db } from "~/server/db";
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) { try { const { id } = await context.params; const parsed = await parseUpdateBusinessRecord(await request.formData()); return Response.json({ record: await updateBusinessRecord(db, Number(id), parsed.input, parsed.attachmentAction) }); } catch (error) { return businessErrorResponse(error); } }
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) { try { const { id } = await context.params; return Response.json(await deleteBusinessRecord(db, Number(id))); } catch (error) { return businessErrorResponse(error); } }
