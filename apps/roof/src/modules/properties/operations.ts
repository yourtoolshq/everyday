import type { z } from "zod";

import { invalidInput } from "@yourtoolshq/server/errors";

import type { documentMetadataSchema } from "~/lib/documents";
import type { propertyFieldsSchema } from "~/lib/properties";
import type { dataPlatform } from "~/server/data";
import type { db } from "~/server/db";
import * as repository from "./repository";

type Context = { db: typeof db; files: typeof dataPlatform.files };
export function attachDocument(
  ctx: Context,
  input: z.infer<typeof documentMetadataSchema> & {
    propertyId: string;
    file: string;
  },
) {
  return ctx.files.withFiles(ctx.db, async (tx, files) => {
    await repository.requireProperty(tx, input.propertyId);
    await repository.requireEvent(tx, input.propertyId, input.eventId);
    await repository.requireInsurance(tx, input.propertyId, input.insuranceId);
    await repository.requireLease(tx, input.propertyId, input.leaseId);
    const file = await files.claim(input.file);
    return repository.insertDocument(tx, {
      propertyId: input.propertyId,
      eventId: input.eventId ?? null,
      insuranceId: input.insuranceId ?? null,
      leaseId: input.leaseId ?? null,
      title: input.title,
      type: input.type,
      documentDate: input.documentDate ?? null,
      notes: input.notes ?? null,
      fileId: file.id,
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    });
  });
}
export function removeDocument(ctx: Context, id: string) {
  return ctx.files.withFiles(ctx.db, async (tx, files) => {
    const document = await repository.requireDocument(tx, id);
    await repository.deleteDocument(tx, id);
    await files.remove(document.fileId);
    return document;
  });
}

export function saveProperty(
  ctx: Context,
  input: z.infer<typeof propertyFieldsSchema> & { photo?: string | null },
  id?: string,
) {
  return ctx.files.withFiles(ctx.db, async (tx, files) => {
    const existing = id ? await repository.requireProperty(tx, id) : null;
    const property = await repository.saveProperty(tx, input, id);
    if (input.photo !== undefined) {
      const photo = input.photo ? await files.claim(input.photo) : null;
      if (
        photo &&
        !["image/jpeg", "image/png", "image/webp"].includes(photo.mimeType)
      )
        throw invalidInput("Choose a JPEG, PNG, or WebP property photo.");
      await repository.setPropertyPhoto(tx, property.id, photo?.id ?? null);
      if (existing?.photoFileId) await files.remove(existing.photoFileId);
    }
    return repository.requireProperty(tx, property.id);
  });
}
