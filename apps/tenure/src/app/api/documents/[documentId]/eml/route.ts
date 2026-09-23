import { eq } from "drizzle-orm";
import { z } from "zod";

import { isEmlMimeType } from "~/lib/documents";
import { parseEml } from "~/lib/eml";
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
      mimeType: documents.mimeType,
    })
    .from(documents)
    .where(eq(documents.id, parsed.data.documentId));
  if (!document || !isEmlMimeType(document.mimeType)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const bytes = new Uint8Array(await readDocument(document.storageKey));
    const parsedEml = await parseEml(bytes);
    return Response.json(parsedEml, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response("File not found", { status: 404 });
    }
    throw error;
  }
}
