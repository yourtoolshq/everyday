import { basename } from "node:path";

import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  detectDocumentFile,
  documentMetadataSchema,
  maxDocumentBytes,
  titleFromFilename,
} from "~/lib/documents";
import { databaseReady, db } from "~/server/db";
import { discussions, documents, employments } from "~/server/db/schema";
import { removeDocument, writeDocument } from "~/server/documents/storage";

export const runtime = "nodejs";

const paramsSchema = z.object({ employmentId: z.string().uuid() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ employmentId: string }> },
) {
  await databaseReady;
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return errorResponse("Invalid employment", 400);

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

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return errorResponse("Choose a non-empty file.", 400);
  }
  if (file.size > maxDocumentBytes) {
    return errorResponse("The file must be 25 MB or smaller.", 413);
  }

  const originalFilename = safeOriginalFilename(file.name);
  const discussionIdValue = form.get("discussionId");
  const titleValue = form.get("title");
  const metadata = documentMetadataSchema.safeParse({
    title:
      typeof titleValue === "string" && titleValue.trim()
        ? titleValue
        : titleFromFilename(originalFilename),
    type: form.get("type"),
    documentDate:
      typeof form.get("documentDate") === "string" ? form.get("documentDate") : null,
    notes: typeof form.get("notes") === "string" ? form.get("notes") : null,
    discussionId:
      typeof discussionIdValue === "string" && discussionIdValue.trim()
        ? discussionIdValue
        : null,
  });
  if (!metadata.success) return errorResponse("Choose a type and enter a title.", 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectDocumentFile(bytes, originalFilename);
  if (!detected) {
    return errorResponse("Upload a PDF, JPEG, PNG, WebP, HEIC, or EML file.", 415);
  }

  const [employment] = await db
    .select({ id: employments.id })
    .from(employments)
    .where(eq(employments.id, parsedParams.data.employmentId));
  if (!employment) return errorResponse("Employment not found.", 404);

  if (metadata.data.discussionId) {
    const [discussion] = await db
      .select({ id: discussions.id, employmentId: discussions.employmentId })
      .from(discussions)
      .where(eq(discussions.id, metadata.data.discussionId));
    if (!discussion || discussion.employmentId !== employment.id) {
      return errorResponse("Discussion not found.", 404);
    }
  }

  const id = crypto.randomUUID();
  const storageKey = `${crypto.randomUUID()}.${detected.extension}`;

  await writeDocument(storageKey, bytes);
  try {
    const [document] = await db
      .insert(documents)
      .values({
        id,
        employmentId: employment.id,
        discussionId: metadata.data.discussionId ?? null,
        title: metadata.data.title,
        type: metadata.data.type,
        documentDate: metadata.data.documentDate ?? null,
        notes: metadata.data.notes ?? null,
        originalFilename,
        storageKey,
        mimeType: detected.mimeType,
        sizeBytes: file.size,
      })
      .returning({
        id: documents.id,
        employmentId: documents.employmentId,
        discussionId: documents.discussionId,
        type: documents.type,
        title: documents.title,
        documentDate: documents.documentDate,
        notes: documents.notes,
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
