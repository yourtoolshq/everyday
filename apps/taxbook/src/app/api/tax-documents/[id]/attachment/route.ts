import { TRPCError } from "@trpc/server";

import { taxDocumentErrorResponse } from "~/server/api/tax-document-http";
import { getActiveTaxDocumentAttachment } from "~/server/api/tax-document-values";
import { db } from "~/server/db";

function contentDisposition(fileName: string, download: boolean) {
  const safeAscii = fileName
    .replaceAll(/[\r\n]/g, "")
    .replaceAll(/[^ -~]/g, "_")
    .replaceAll(/["\\]/g, "_");
  const encoded = encodeURIComponent(fileName);
  return `${download ? "attachment" : "inline"}; filename="${safeAscii}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid Tax Document ID.",
      });
    }
    const attachment = await getActiveTaxDocumentAttachment(db, id);
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(Uint8Array.from(attachment.data).buffer, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(attachment.sizeBytes),
        "Content-Disposition": contentDisposition(
          attachment.fileName,
          download,
        ),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return taxDocumentErrorResponse(error);
  }
}
