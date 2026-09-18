import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNotNull, ne, not } from "drizzle-orm";
import { z } from "zod";

import { documentTypes } from "~/lib/documents";
import { defaultStatementFrequency } from "~/lib/statement-frequency";
import {
  accountEvents,
  accountTermsSnapshots,
  accounts,
  documents,
  institutions,
  statementExpectations,
} from "~/server/db/schema";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { validateStatementPeriod } from "~/server/documents/statement-upload";
import {
  discardStagedDocuments,
  restoreStagedDocuments,
  stageDocumentsForDeletion,
} from "~/server/documents/storage";

const idInput = z.object({ id: z.string().uuid() });
const overviewFilter = z.object({
  accountId: z.string().uuid().optional(),
  excludeStatements: z.boolean().optional(),
});
const now = () => new Date().toISOString();

const publicDocumentFields = {
  id: documents.id,
  accountId: documents.accountId,
  type: documents.type,
  periodKey: documents.periodKey,
  title: documents.title,
  documentDate: documents.documentDate,
  notes: documents.notes,
  eventId: documents.eventId,
  termsSnapshotId: documents.termsSnapshotId,
  originalFilename: documents.originalFilename,
  mimeType: documents.mimeType,
  sizeBytes: documents.sizeBytes,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
};

const updateDocumentInput = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(160),
    type: z.enum(documentTypes),
    documentDate: z.string().trim().max(10).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    periodKey: z.string().trim().min(1).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "statement" && !data.periodKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose a statement period.",
        path: ["periodKey"],
      });
    }
    if (data.type !== "statement" && data.periodKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only statements can be linked to a period.",
        path: ["periodKey"],
      });
    }
  });

export const documentsRouter = createTRPCRouter({
  overview: publicProcedure.input(overviewFilter.optional()).query(async ({ ctx, input }) => {
    const conditions = [];
    if (input?.accountId) {
      conditions.push(eq(documents.accountId, input.accountId));
    }
    if (input?.excludeStatements) {
      conditions.push(not(eq(documents.type, "statement")));
    }

    const baseQuery = ctx.db
      .select({
        ...publicDocumentFields,
        accountName: accounts.displayName,
        institutionName: institutions.name,
        linkedActivityTitle: accountEvents.title,
        linkedActivityType: accountEvents.type,
        linkedActivityStartDate: accountEvents.startDate,
        linkedTermsEffectiveDate: accountTermsSnapshots.effectiveDate,
      })
      .from(documents)
      .innerJoin(accounts, eq(documents.accountId, accounts.id))
      .innerJoin(institutions, eq(accounts.institutionId, institutions.id))
      .leftJoin(accountEvents, eq(documents.eventId, accountEvents.id))
      .leftJoin(accountTermsSnapshots, eq(documents.termsSnapshotId, accountTermsSnapshots.id));

    const rows =
      conditions.length > 0
        ? await baseQuery
            .where(and(...conditions))
            .orderBy(desc(documents.createdAt))
        : await baseQuery.orderBy(desc(documents.createdAt));

    return rows.map((row) => ({
      id: row.id,
      accountId: row.accountId,
      type: row.type,
      periodKey: row.periodKey,
      title: row.title,
      documentDate: row.documentDate,
      notes: row.notes,
      eventId: row.eventId,
      termsSnapshotId: row.termsSnapshotId,
      originalFilename: row.originalFilename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      accountName: row.accountName,
      institutionName: row.institutionName,
      linkedActivity: row.eventId
        ? {
            id: row.eventId,
            title: row.linkedActivityTitle!,
            type: row.linkedActivityType!,
            startDate: row.linkedActivityStartDate!,
          }
        : null,
      linkedTermsSnapshot: row.termsSnapshotId
        ? {
            id: row.termsSnapshotId,
            effectiveDate: row.linkedTermsEffectiveDate!,
          }
        : null,
    }));
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

  update: publicProcedure.input(updateDocumentInput).mutation(async ({ ctx, input }) => {
    const [existing] = await ctx.db
      .select({
        id: documents.id,
        accountId: documents.accountId,
        type: documents.type,
        periodKey: documents.periodKey,
      })
      .from(documents)
      .where(eq(documents.id, input.id));
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });

    if (input.type === "statement" && input.periodKey) {
      const [account] = await ctx.db
        .select({
          openedDate: accounts.openedDate,
          closedDate: accounts.closedDate,
          status: accounts.status,
          statementFrequency: statementExpectations.frequency,
        })
        .from(accounts)
        .leftJoin(statementExpectations, eq(statementExpectations.accountId, accounts.id))
        .where(eq(accounts.id, existing.accountId));
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
      }

      const validation = validateStatementPeriod(
        {
          openedDate: account.openedDate,
          closedDate: account.closedDate,
          status: account.status,
          statementFrequency: account.statementFrequency ?? defaultStatementFrequency,
        },
        input.periodKey,
      );
      if (!validation.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: validation.error });
      }

      const [duplicate] = await ctx.db
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.accountId, existing.accountId),
            eq(documents.type, "statement"),
            eq(documents.periodKey, validation.period.key),
            ne(documents.id, existing.id),
          ),
        );
      if (duplicate) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This account already has a statement for that period.",
        });
      }

      const [document] = await ctx.db
        .update(documents)
        .set({
          title: input.title,
          type: "statement",
          periodKey: validation.period.key,
          documentDate: input.documentDate ?? null,
          notes: input.notes ?? null,
          updatedAt: now(),
        })
        .where(eq(documents.id, input.id))
        .returning(publicDocumentFields);
      return document;
    }

    const [document] = await ctx.db
      .update(documents)
      .set({
        title: input.title,
        type: input.type,
        periodKey: null,
        documentDate: input.documentDate ?? null,
        notes: input.notes ?? null,
        updatedAt: now(),
      })
      .where(eq(documents.id, input.id))
      .returning(publicDocumentFields);
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
