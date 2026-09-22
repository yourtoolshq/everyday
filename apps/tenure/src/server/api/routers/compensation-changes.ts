import { TRPCError } from "@trpc/server";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  compensationInputSchema,
  enrichCompensationChanges,
  getCurrentCompensationChange,
} from "~/lib/compensation";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  compensationChanges,
  discussions,
  documents,
  employments,
} from "~/server/db/schema";

const idInput = z.object({ id: z.string().uuid() });
const employmentIdInput = z.object({ employmentId: z.string().uuid() });
const now = () => new Date().toISOString();

const publicCompensationFields = {
  id: compensationChanges.id,
  employmentId: compensationChanges.employmentId,
  type: compensationChanges.type,
  currency: compensationChanges.currency,
  effectiveDate: compensationChanges.effectiveDate,
  amountCents: compensationChanges.amountCents,
  commissionBasisPoints: compensationChanges.commissionBasisPoints,
  notes: compensationChanges.notes,
  documentId: compensationChanges.documentId,
  discussionId: compensationChanges.discussionId,
  createdAt: compensationChanges.createdAt,
  updatedAt: compensationChanges.updatedAt,
};

async function assertEmploymentLinks(
  ctx: { db: typeof import("~/server/db").db },
  employmentId: string,
  documentId: string | null | undefined,
  discussionId: string | null | undefined,
) {
  if (documentId) {
    const [document] = await ctx.db
      .select({ employmentId: documents.employmentId })
      .from(documents)
      .where(eq(documents.id, documentId));
    if (!document || document.employmentId !== employmentId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Choose a document from this employment.",
      });
    }
  }

  if (discussionId) {
    const [discussion] = await ctx.db
      .select({ employmentId: discussions.employmentId })
      .from(discussions)
      .where(eq(discussions.id, discussionId));
    if (!discussion || discussion.employmentId !== employmentId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Choose a discussion from this employment.",
      });
    }
  }
}

function mapCompensationValues(input: z.infer<typeof compensationInputSchema>) {
  return {
    type: input.type,
    currency: input.currency,
    effectiveDate: input.effectiveDate,
    amountCents:
      input.type === "commission" ? null : (input.amountCents ?? null),
    commissionBasisPoints:
      input.type === "commission"
        ? (input.commissionBasisPoints ?? null)
        : null,
    notes: input.notes ?? null,
    documentId: input.documentId ?? null,
    discussionId: input.discussionId ?? null,
  };
}

async function listEnrichedByEmployment(
  ctx: { db: typeof import("~/server/db").db },
  employmentId: string,
) {
  const rows = await ctx.db
    .select(publicCompensationFields)
    .from(compensationChanges)
    .where(eq(compensationChanges.employmentId, employmentId))
    .orderBy(
      desc(compensationChanges.effectiveDate),
      desc(compensationChanges.createdAt),
    );

  const documentIds = rows
    .map((row) => row.documentId)
    .filter(Boolean) as string[];
  const discussionIds = rows
    .map((row) => row.discussionId)
    .filter(Boolean) as string[];

  const linkedDocuments =
    documentIds.length > 0
      ? await ctx.db
          .select({ id: documents.id, title: documents.title })
          .from(documents)
          .where(inArray(documents.id, documentIds))
      : [];
  const linkedDiscussions =
    discussionIds.length > 0
      ? await ctx.db
          .select({ id: discussions.id, title: discussions.title })
          .from(discussions)
          .where(inArray(discussions.id, discussionIds))
      : [];

  return enrichCompensationChanges(rows, {
    documentTitleById: new Map(
      linkedDocuments.map((item) => [item.id, item.title]),
    ),
    discussionTitleById: new Map(
      linkedDiscussions.map((item) => [item.id, item.title]),
    ),
  });
}

export const compensationChangesRouter = createTRPCRouter({
  listByEmployment: publicProcedure
    .input(employmentIdInput)
    .query(async ({ ctx, input }) => {
      return listEnrichedByEmployment(ctx, input.employmentId);
    }),

  getCurrentByEmployment: publicProcedure
    .input(employmentIdInput)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select(publicCompensationFields)
        .from(compensationChanges)
        .where(eq(compensationChanges.employmentId, input.employmentId))
        .orderBy(asc(compensationChanges.effectiveDate));

      return getCurrentCompensationChange(rows);
    }),

  create: publicProcedure
    .input(employmentIdInput.and(compensationInputSchema))
    .mutation(async ({ ctx, input }) => {
      const [employment] = await ctx.db
        .select({ id: employments.id })
        .from(employments)
        .where(eq(employments.id, input.employmentId));
      if (!employment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Employment not found.",
        });
      }

      await assertEmploymentLinks(
        ctx,
        input.employmentId,
        input.documentId,
        input.discussionId,
      );

      const [change] = await ctx.db
        .insert(compensationChanges)
        .values({
          employmentId: input.employmentId,
          ...mapCompensationValues(input),
        })
        .returning(publicCompensationFields);

      if (!change) throw new Error("Compensation change creation failed.");
      return change;
    }),

  update: publicProcedure
    .input(idInput.and(compensationInputSchema))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ employmentId: compensationChanges.employmentId })
        .from(compensationChanges)
        .where(eq(compensationChanges.id, input.id));
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Compensation change not found.",
        });
      }

      await assertEmploymentLinks(
        ctx,
        existing.employmentId,
        input.documentId,
        input.discussionId,
      );

      const [change] = await ctx.db
        .update(compensationChanges)
        .set({
          ...mapCompensationValues(input),
          updatedAt: now(),
        })
        .where(eq(compensationChanges.id, input.id))
        .returning(publicCompensationFields);

      if (!change) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Compensation change not found.",
        });
      }
      return change;
    }),

  delete: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [change] = await ctx.db
      .delete(compensationChanges)
      .where(eq(compensationChanges.id, input.id))
      .returning({ id: compensationChanges.id });
    if (!change) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Compensation change not found.",
      });
    }
    return change;
  }),
});
