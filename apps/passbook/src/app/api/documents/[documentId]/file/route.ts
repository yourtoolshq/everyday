import { eq } from "drizzle-orm";
import { z } from "zod";

import { databaseReady, db } from "~/server/db";
import { documents } from "~/server/db/schema";
import { readDocument } from "~/server/documents/storage";

export const runtime = "nodejs";

const paramsSchema = z.object({ documentId: z.string().uuid() });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  await databaseReady;
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return new Response("Not found", { status: 404 });

  const [document] = await db
    .select({
      storageKey: documents.storageKey,
      originalFilename: documents.originalFilename,
      mimeType: documents.mimeType,
    })
    .from(documents)
    .where(eq(documents.id, parsed.data.documentId));
  if (!document) return new Response("Not found", { status: 404 });

  try {
    const bytes = await readDocument(document.storageKey);
    return new Response(bytes, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(document.originalFilename),
        "Content-Type": document.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response("File not found", { status: 404 });
    }
    throw error;
  }
}

function contentDisposition(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
