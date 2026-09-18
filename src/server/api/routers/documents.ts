import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { documentMetadataSchema } from "~/lib/documents";
import { accounts, documents, institutions } from "~/server/db/schema";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  discardStagedDocuments,
  restoreStagedDocuments,
  stageDocumentsForDeletion,
} from "~/server/documents/storage";

const idInput = z.object({ id: z.string().uuid() });
const accountFilter = z.object({ accountId: z.string().uuid().optional() });
const now = () => new Date().toISOString();

const publicDocumentFields = {
  id: documents.id,
  accountId: documents.accountId,
  type: documents.type,
  periodKey: documents.periodKey,
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
  overview: publicProcedure.input(accountFilter.optional()).query(async ({ ctx, input }) => {
    const baseQuery = ctx.db
      .select({
        ...publicDocumentFields,
        accountName: accounts.displayName,
        institutionName: institutions.name,
      })
      .from(documents)
      .innerJoin(accounts, eq(documents.accountId, accounts.id))
      .innerJoin(institutions, eq(accounts.institutionId, institutions.id));

    if (input?.accountId) {
      return baseQuery
        .where(eq(documents.accountId, input.accountId))
        .orderBy(desc(documents.createdAt));
    }

    return baseQuery.orderBy(desc(documents.createdAt));
  }),

  statementDocumentsByAccount: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        accountId: documents.accountId,
        periodKey: documents.periodKey,
        documentId: documents.id,
      })
      .from(documents)
      .where(and(eq(documents.type, "statement"), isNotNull(documents.periodKey)));

    const byAccount: Record<string, Record<string, string>> = {};
    for (const row of rows) {
      if (!row.periodKey) continue;
      const accountDocuments = byAccount[row.accountId] ?? {};
      accountDocuments[row.periodKey] = row.documentId;
      byAccount[row.accountId] = accountDocuments;
    }

    return byAccount;
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
