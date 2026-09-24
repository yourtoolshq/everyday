import { eq } from "drizzle-orm";
import { z } from "zod";

import { isEmlMimeType } from "~/lib/documents";
import { parseEml } from "~/lib/eml";
import { dataPlatform } from "~/server/data";
import { db } from "~/server/db";
import { documents } from "~/server/db/schema";

export const runtime = "nodejs";

const paramsSchema = z.object({ documentId: z.string().uuid() });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return new Response("Not found", { status: 404 });

  const [document] = await db
    .select({
      fileId: documents.fileId,
      mimeType: documents.mimeType,
    })
    .from(documents)
    .where(eq(documents.id, parsed.data.documentId));
  if (!document || !isEmlMimeType(document.mimeType)) {
    return new Response("Not found", { status: 404 });
  }

  const stored = await dataPlatform.files.read(document.fileId);
  if (!stored) return new Response("File not found", { status: 404 });

  const parsedEml = await parseEml(new Uint8Array(stored.bytes));
  return Response.json(parsedEml, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
