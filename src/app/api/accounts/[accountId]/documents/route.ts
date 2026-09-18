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
import { accounts, documents } from "~/server/db/schema";
import { removeDocument, writeDocument } from "~/server/documents/storage";

export const runtime = "nodejs";

const paramsSchema = z.object({ accountId: z.string().uuid() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  await databaseReady;
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return errorResponse("Invalid account", 400);

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
  });
  if (!metadata.success) return errorResponse("Choose a type and enter a title.", 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectDocumentFile(bytes);
  if (!detected) {
    return errorResponse("Upload a PDF, JPEG, PNG, WebP, or HEIC file.", 415);
  }

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, parsedParams.data.accountId));
  if (!account) return errorResponse("Account not found.", 404);

  const id = crypto.randomUUID();
  const storageKey = `${crypto.randomUUID()}.${detected.extension}`;

  await writeDocument(storageKey, bytes);
  try {
    const [document] = await db
      .insert(documents)
      .values({
        id,
        accountId: account.id,
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
        accountId: documents.accountId,
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
