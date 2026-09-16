import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { documentMetadataSchema } from "~/lib/documents";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { documents, people, visits } from "~/server/db/schema";
import {
  discardStagedDocuments,
  restoreStagedDocuments,
  stageDocumentsForDeletion,
} from "~/server/documents/storage";

const idInput = z.object({ id: z.string().uuid() });
const now = () => new Date().toISOString();

const publicDocumentFields = {
  id: documents.id,
  visitId: documents.visitId,
  type: documents.type,
  title: documents.title,
  originalFilename: documents.originalFilename,
  mimeType: documents.mimeType,
  sizeBytes: documents.sizeBytes,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
};

export const documentsRouter = createTRPCRouter({
  overview: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        ...publicDocumentFields,
        visitTitle: visits.title,
        visitStartsAt: visits.startsAt,
        personId: people.id,
        personName: people.displayName,
      })
      .from(documents)
      .innerJoin(visits, eq(documents.visitId, visits.id))
      .innerJoin(people, eq(visits.personId, people.id))
      .orderBy(desc(visits.startsAt), desc(documents.createdAt));
  }),

  update: publicProcedure
    .input(idInput.and(documentMetadataSchema))
    .mutation(async ({ ctx, input }) => {
      const [document] = await ctx.db
        .update(documents)
        .set({ title: input.title, type: input.type, updatedAt: now() })
        .where(eq(documents.id, input.id))
        .returning(publicDocumentFields);
      if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      return document;
    }),

  delete: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [document] = await ctx.db
      .select({ id: documents.id, storageKey: documents.storageKey })
      .from(documents)
      .where(eq(documents.id, input.id));
    if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

    const staged = await stageDocumentsForDeletion([document.storageKey]);
    try {
      await ctx.db.delete(documents).where(eq(documents.id, input.id));
    } catch (error) {
      await restoreStagedDocuments(staged);
      throw error;
    }
    await discardStagedDocuments(staged);
    return { id: document.id };
  }),
});
