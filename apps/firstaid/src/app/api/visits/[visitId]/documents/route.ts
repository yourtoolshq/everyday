import { basename } from "node:path";

import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  detectDocumentFile,
  documentMetadataSchema,
  maxDocumentBytes,
} from "~/lib/documents";
import { databaseReady, db } from "~/server/db";
import { documents, visits } from "~/server/db/schema";
import { resolveDocumentClaimId } from "~/server/documents/claim-link";
import { removeDocument, writeDocument } from "~/server/documents/storage";

export const runtime = "nodejs";

const paramsSchema = z.object({ visitId: z.string().uuid() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ visitId: string }> },
) {
  await databaseReady;
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return errorResponse("Invalid visit", 400);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxDocumentBytes + 1024 * 1024) {
    return errorResponse("The file must be 25 MB or smaller.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("The upload could not be read.", 400);
  }

  const claimIdValue = form.get("claimId");
  const metadata = documentMetadataSchema.safeParse({
    title: form.get("title"),
    type: form.get("type"),
    claimId:
      typeof claimIdValue === "string" && claimIdValue.trim() && claimIdValue !== "none"
        ? claimIdValue
        : null,
  });
  if (!metadata.success) return errorResponse("Choose a type and enter a title.", 400);

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return errorResponse("Choose a non-empty file.", 400);
  }
  if (file.size > maxDocumentBytes) return errorResponse("The file must be 25 MB or smaller.", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectDocumentFile(bytes);
  if (!detected) {
    return errorResponse("Upload a PDF, JPEG, PNG, WebP, or HEIC file.", 415);
  }

  const [visit] = await db
    .select({ id: visits.id })
    .from(visits)
    .where(eq(visits.id, parsedParams.data.visitId));
  if (!visit) return errorResponse("Visit not found.", 404);

  let claimId: string | null;
  try {
    claimId = await resolveDocumentClaimId(
      db,
      visit.id,
      metadata.data.type,
      metadata.data.claimId,
    );
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "The claim could not be linked.",
      400,
    );
  }

  const id = crypto.randomUUID();
  const storageKey = `${crypto.randomUUID()}.${detected.extension}`;
  const originalFilename = safeOriginalFilename(file.name);

  await writeDocument(storageKey, bytes);
  try {
    const [document] = await db
      .insert(documents)
      .values({
        id,
        visitId: visit.id,
        claimId,
        title: metadata.data.title,
        type: metadata.data.type,
        originalFilename,
        storageKey,
        mimeType: detected.mimeType,
        sizeBytes: file.size,
      })
      .returning({
        id: documents.id,
        visitId: documents.visitId,
        claimId: documents.claimId,
        type: documents.type,
        title: documents.title,
        originalFilename: documents.originalFilename,
        mimeType: documents.mimeType,
        sizeBytes: documents.sizeBytes,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      });
    return Response.json(document, { status: 201 });
  } catch (error) {
    await removeDocument(storageKey);
    throw error;
  }
}

function safeOriginalFilename(filename: string) {
  const normalized = basename(filename.replaceAll("\\", "/"))
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return (normalized || "document").slice(0, 255);
}

function errorResponse(error: string, status: number) {
  return Response.json({ error }, { status });
}
