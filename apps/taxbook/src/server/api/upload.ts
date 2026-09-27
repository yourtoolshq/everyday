import { TRPCError } from "@trpc/server";

import { detectFileType } from "@yourtoolshq/data/files";

import type { AttachmentInput } from "~/domain/record";
import { dataPlatform } from "~/server/data";

export async function stageAttachment(form: FormData) {
  const entry = form.get("attachment");
  if (typeof entry === "string" && entry.length > 0) {
    return {
      token: entry,
      fileName: "",
      mimeType: "application/pdf" as const,
      sizeBytes: 0,
    } satisfies AttachmentInput;
  }
  if (!(entry instanceof File) || entry.size === 0) return null;
  if (entry.size > 25 * 1024 * 1024) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "The file must be 25 MB or smaller.",
    });
  }
  const fileName = entry.name.split(/[\\/]/).pop()?.trim() || "attachment";
  if (fileName.length > 255) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Attachment filename must be 255 characters or fewer.",
    });
  }
  const bytes = new Uint8Array(await entry.arrayBuffer());
  const type = detectFileType(bytes);
  if (!type || (type.group !== "pdf" && type.group !== "image")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Use a PDF or supported image attachment.",
    });
  }
  const staged = await dataPlatform.files.stage({
    endpoint: "document",
    originalFilename: fileName,
    bytes,
    type,
  });
  return {
    token: staged.token,
    fileName: staged.name,
    mimeType: staged.mimeType as AttachmentInput["mimeType"],
    sizeBytes: staged.size,
  } satisfies AttachmentInput;
}
