import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { documentMetadataSchema } from "~/lib/documents";
import { discussions, documents } from "~/server/db/schema";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  discardStagedDocuments,
  restoreStagedDocuments,
  stageDocumentsForDeletion,
} from "~/server/documents/storage";

const idInput = z.object({ id: z.string().uuid() });
const employmentFilter = z.object({ employmentId: z.string().uuid() });
const now = () => new Date().toISOString();

const publicDocumentFields = {
  id: documents.id,
  employmentId: documents.employmentId,
  discussionId: documents.discussionId,
  type: documents.type,
  title: documents.title,
  documentDate: documents.documentDate,
  notes: documents.notes,
  originalFilename: documents.originalFilename,
  mimeType: documents.mimeType,
  sizeBytes: documents.sizeBytes,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
};

export const documentsRouter = createTRPCRouter({
  listByEmployment: publicProcedure.input(employmentFilter).query(async ({ ctx, input }) => {
    return ctx.db
      .select({
        ...publicDocumentFields,
        discussionTitle: discussions.title,
      })
      .from(documents)
      .leftJoin(discussions, eq(documents.discussionId, discussions.id))
      .where(eq(documents.employmentId, input.employmentId))
      .orderBy(desc(documents.documentDate), desc(documents.createdAt));
  }),

  update: publicProcedure
    .input(idInput.and(documentMetadataSchema))
    .mutation(async ({ ctx, input }) => {
      if (input.discussionId) {
        const [discussion] = await ctx.db
          .select({ id: discussions.id, employmentId: discussions.employmentId })
          .from(discussions)
          .where(eq(discussions.id, input.discussionId));
        const [document] = await ctx.db
          .select({ employmentId: documents.employmentId })
          .from(documents)
          .where(eq(documents.id, input.id));
        if (
          !discussion ||
          !document ||
          discussion.employmentId !== document.employmentId
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Choose a discussion from this employment.",
          });
        }
      }

      const [updated] = await ctx.db
        .update(documents)
        .set({
          title: input.title,
          type: input.type,
          documentDate: input.documentDate ?? null,
          notes: input.notes ?? null,
          discussionId: input.discussionId ?? null,
          updatedAt: now(),
        })
        .where(eq(documents.id, input.id))
        .returning(publicDocumentFields);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
      return updated;
    }),

  delete: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [document] = await ctx.db
      .select({ id: documents.id, storageKey: documents.storageKey })
      .from(documents)
      .where(eq(documents.id, input.id));
    if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });

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
