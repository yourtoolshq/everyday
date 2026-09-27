import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { fileToken } from "@yourtoolshq/data/files";

import { documentMetadataSchema } from "~/lib/documents";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  compensationChanges,
  discussions,
  documents,
  employments,
  paychecks,
} from "~/server/db/schema";

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
  fileId: documents.fileId,
  originalFilename: documents.originalFilename,
  mimeType: documents.mimeType,
  sizeBytes: documents.sizeBytes,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
};

export const documentsRouter = createTRPCRouter({
  listByEmployment: publicProcedure
    .input(employmentFilter)
    .query(async ({ ctx, input }) => {
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

  create: publicProcedure
    .input(
      documentMetadataSchema.and(
        z.object({
          employmentId: z.string().uuid(),
          file: fileToken("document"),
        }),
      ),
    )
    .mutation(({ ctx, input }) =>
      ctx.files.withFiles(ctx.db, async (tx, files) => {
        const [employment] = await tx
          .select({ id: employments.id })
          .from(employments)
          .where(eq(employments.id, input.employmentId));
        if (!employment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Employment not found.",
          });
        }

        if (input.discussionId) {
          const [discussion] = await tx
            .select({
              id: discussions.id,
              employmentId: discussions.employmentId,
            })
            .from(discussions)
            .where(eq(discussions.id, input.discussionId));
          if (!discussion || discussion.employmentId !== employment.id) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Choose a discussion from this employment.",
            });
          }
        }

        const file = await files.claim(input.file);
        const [document] = await tx
          .insert(documents)
          .values({
            employmentId: employment.id,
            discussionId: input.discussionId ?? null,
            title: input.title,
            type: input.type,
            documentDate: input.documentDate ?? null,
            notes: input.notes ?? null,
            fileId: file.id,
            originalFilename: file.originalFilename,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
          })
          .returning(publicDocumentFields);
        if (!document) throw new Error("Document creation failed.");
        return document;
      }),
    ),

  update: publicProcedure
    .input(idInput.and(documentMetadataSchema))
    .mutation(async ({ ctx, input }) => {
      if (input.discussionId) {
        const [discussion] = await ctx.db
          .select({
            id: discussions.id,
            employmentId: discussions.employmentId,
          })
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
      if (!updated)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found.",
        });
      return updated;
    }),

  delete: publicProcedure.input(idInput).mutation(({ ctx, input }) =>
    ctx.files.withFiles(ctx.db, async (tx, files) => {
      await tx
        .update(paychecks)
        .set({ documentId: null, updatedAt: now() })
        .where(eq(paychecks.documentId, input.id));
      await tx
        .update(compensationChanges)
        .set({ documentId: null, updatedAt: now() })
        .where(eq(compensationChanges.documentId, input.id));

      const [document] = await tx
        .delete(documents)
        .where(eq(documents.id, input.id))
        .returning({ id: documents.id, fileId: documents.fileId });
      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found.",
        });
      }

      await files.remove(document.fileId);
      return { id: document.id };
    }),
  ),
});
