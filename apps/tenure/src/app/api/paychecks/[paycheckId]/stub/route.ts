import { basename } from "node:path";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { detectDocumentFile, maxDocumentBytes } from "~/lib/documents";
import { suggestPayStubTitle } from "~/lib/pay-stubs";
import { databaseReady, db } from "~/server/db";
import {
  documents,
  employers,
  employments,
  paychecks,
  people,
} from "~/server/db/schema";
import { removeDocument, writeDocument } from "~/server/documents/storage";

export const runtime = "nodejs";

const paramsSchema = z.object({ paycheckId: z.string().uuid() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ paycheckId: string }> },
) {
  await databaseReady;
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return errorResponse("Invalid paycheck", 400);

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

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectDocumentFile(bytes, originalFilename);
  if (!detected) {
    return errorResponse("Upload a PDF, JPEG, PNG, WebP, or HEIC file.", 415);
  }

  const [paycheck] = await db
    .select({
      id: paychecks.id,
      employmentId: paychecks.employmentId,
      payDate: paychecks.payDate,
      periodStartDate: paychecks.periodStartDate,
      periodEndDate: paychecks.periodEndDate,
      documentId: paychecks.documentId,
      employerName: employers.name,
      personName: people.displayName,
    })
    .from(paychecks)
    .innerJoin(employments, eq(paychecks.employmentId, employments.id))
    .innerJoin(employers, eq(employments.employerId, employers.id))
    .innerJoin(people, eq(employments.personId, people.id))
    .where(eq(paychecks.id, parsedParams.data.paycheckId));
  if (!paycheck) return errorResponse("Paycheck not found.", 404);

  const titleValue = form.get("title");
  const title =
    typeof titleValue === "string" && titleValue.trim()
      ? titleValue.trim().slice(0, 160)
      : suggestPayStubTitle({
          employerName: paycheck.employerName,
          personName: paycheck.personName,
          periodStartDate: paycheck.periodStartDate,
          periodEndDate: paycheck.periodEndDate,
          payDate: paycheck.payDate,
        });

  const id = crypto.randomUUID();
  const storageKey = `${crypto.randomUUID()}.${detected.extension}`;

  await writeDocument(storageKey, bytes);
  try {
    const [document] = await db
      .insert(documents)
      .values({
        id,
        employmentId: paycheck.employmentId,
        type: "pay_stub",
        title,
        documentDate: paycheck.payDate,
        notes: null,
        originalFilename,
        storageKey,
        mimeType: detected.mimeType,
        sizeBytes: file.size,
      })
      .returning({
        id: documents.id,
        title: documents.title,
        originalFilename: documents.originalFilename,
      });

    if (paycheck.documentId) {
      const [previous] = await db
        .select({ storageKey: documents.storageKey })
        .from(documents)
        .where(eq(documents.id, paycheck.documentId));
      if (previous) {
        await removeDocument(previous.storageKey);
        await db.delete(documents).where(eq(documents.id, paycheck.documentId));
      }
    }

    await db
      .update(paychecks)
      .set({ documentId: id, updatedAt: new Date().toISOString() })
      .where(eq(paychecks.id, paycheck.id));

    return Response.json(
      {
        paycheckId: paycheck.id,
        document,
      },
      { status: 201 },
    );
  } catch (error) {
    await removeDocument(storageKey);
    throw error;
  }
}

function safeOriginalFilename(filename: string) {
  const normalized = basename(filename.replaceAll("\\", "/"))
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return (normalized || "pay-stub").slice(0, 255);
}

function errorResponse(error: string, status: number) {
  return Response.json({ error }, { status });
}
