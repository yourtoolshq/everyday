import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { documentMetadataSchema } from "~/lib/documents";
import { documents, employers, employments, people } from "~/server/db/schema";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  discardStagedDocuments,
  restoreStagedDocuments,
  stageDocumentsForDeletion,
} from "~/server/documents/storage";

const idInput = z.object({ id: z.string().uuid() });
const employmentFilter = z.object({ employmentId: z.string().uuid().optional() });
const now = () => new Date().toISOString();

const publicDocumentFields = {
  id: documents.id,
  employmentId: documents.employmentId,
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
  overview: publicProcedure.input(employmentFilter.optional()).query(async ({ ctx, input }) => {
    const baseQuery = ctx.db
      .select({
        ...publicDocumentFields,
        employerName: employers.name,
        personName: people.displayName,
        jobTitle: employments.jobTitle,
      })
      .from(documents)
      .innerJoin(employments, eq(documents.employmentId, employments.id))
      .innerJoin(employers, eq(employments.employerId, employers.id))
      .innerJoin(people, eq(employments.personId, people.id));

    if (input?.employmentId) {
      return baseQuery
        .where(eq(documents.employmentId, input.employmentId))
        .orderBy(desc(documents.createdAt));
    }

    return baseQuery.orderBy(desc(documents.createdAt));
  }),

  update: publicProcedure
    .input(idInput.and(documentMetadataSchema))
    .mutation(async ({ ctx, input }) => {
      const [document] = await ctx.db
        .update(documents)
        .set({
          title: input.title,
          type: input.type,
          documentDate: input.documentDate ?? null,
          notes: input.notes ?? null,
          updatedAt: now(),
        })
        .where(eq(documents.id, input.id))
        .returning(publicDocumentFields);
      if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
      return document;
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
