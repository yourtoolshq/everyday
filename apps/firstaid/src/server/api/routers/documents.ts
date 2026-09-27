import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { fileToken } from "@yourtoolshq/data/files";

import { documentMetadataSchema } from "~/lib/documents";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  benefits,
  claims,
  documents,
  people,
  visits,
} from "~/server/db/schema";
import { resolveDocumentClaimId } from "~/server/documents/claim-link";

const idInput = z.object({ id: z.string().uuid() });
const now = () => new Date().toISOString();

const publicDocumentFields = {
  id: documents.id,
  visitId: documents.visitId,
  claimId: documents.claimId,
  type: documents.type,
  title: documents.title,
  fileId: documents.fileId,
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
        claimBenefitName: benefits.name,
      })
      .from(documents)
      .innerJoin(visits, eq(documents.visitId, visits.id))
      .innerJoin(people, eq(visits.personId, people.id))
      .leftJoin(claims, eq(documents.claimId, claims.id))
      .leftJoin(benefits, eq(claims.benefitId, benefits.id))
      .orderBy(desc(visits.startsAt), desc(documents.createdAt));
  }),

  create: publicProcedure
    .input(
      documentMetadataSchema.and(
        z.object({
          visitId: z.string().uuid(),
          file: fileToken("document"),
        }),
      ),
    )
    .mutation(({ ctx, input }) =>
      ctx.files.withFiles(ctx.db, async (tx, files) => {
        const [visit] = await tx
          .select({ id: visits.id })
          .from(visits)
          .where(eq(visits.id, input.visitId));
        if (!visit) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Visit not found.",
          });
        }

        const claimId = await resolveDocumentClaimId(
          tx,
          visit.id,
          input.type,
          input.claimId,
        );
        const file = await files.claim(input.file);
        const [document] = await tx
          .insert(documents)
          .values({
            visitId: visit.id,
            claimId,
            title: input.title,
            type: input.type,
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
      const [existing] = await ctx.db
        .select({ visitId: documents.visitId })
        .from(documents)
        .where(eq(documents.id, input.id));
      if (!existing)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });

      const claimId = await resolveDocumentClaimId(
        ctx.db,
        existing.visitId,
        input.type,
        input.claimId,
      );

      const [document] = await ctx.db
        .update(documents)
        .set({
          title: input.title,
          type: input.type,
          claimId,
          updatedAt: now(),
        })
        .where(eq(documents.id, input.id))
        .returning(publicDocumentFields);
      if (!document)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      return document;
    }),

  delete: publicProcedure.input(idInput).mutation(({ ctx, input }) =>
    ctx.files.withFiles(ctx.db, async (tx, files) => {
      const [document] = await tx
        .delete(documents)
        .where(eq(documents.id, input.id))
        .returning({ id: documents.id, fileId: documents.fileId });
      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      await files.remove(document.fileId);
      return { id: document.id };
    }),
  ),
});
