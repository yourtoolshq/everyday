import { businessErrorResponse } from "~/server/api/business-http";
import { getBusinessRecordAttachment } from "~/server/api/business-values";
import { db } from "~/server/db";

function disposition(fileName: string, download: boolean) {
  const safe = fileName
    .replaceAll(/[\r\n]/g, "")
    .replaceAll(/[^ -~]/g, "_")
    .replaceAll(/["\\]/g, "_");
  return `${download ? "attachment" : "inline"}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const file = await getBusinessRecordAttachment(db, Number(id));
    return new Response(Uint8Array.from(file.data).buffer, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": disposition(
          file.fileName,
          new URL(request.url).searchParams.get("download") === "1",
        ),
        "Content-Length": String(file.sizeBytes),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return businessErrorResponse(error);
  }
}
