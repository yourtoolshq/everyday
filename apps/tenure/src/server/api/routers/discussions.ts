import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { discussionMetadataSchema } from "~/lib/discussions";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { discussions } from "~/server/db/schema";

const idInput = z.object({ id: z.string().uuid() });
const employmentFilter = z.object({ employmentId: z.string().uuid() });
const now = () => new Date().toISOString();

const publicDiscussionFields = {
  id: discussions.id,
  employmentId: discussions.employmentId,
  title: discussions.title,
  discussionDate: discussions.discussionDate,
  participants: discussions.participants,
  body: discussions.body,
  createdAt: discussions.createdAt,
  updatedAt: discussions.updatedAt,
};

export const discussionsRouter = createTRPCRouter({
  listByEmployment: publicProcedure
    .input(employmentFilter)
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select(publicDiscussionFields)
        .from(discussions)
        .where(eq(discussions.employmentId, input.employmentId))
        .orderBy(desc(discussions.discussionDate), desc(discussions.createdAt));
    }),

  create: publicProcedure
    .input(employmentFilter.and(discussionMetadataSchema))
    .mutation(async ({ ctx, input }) => {
      const [discussion] = await ctx.db
        .insert(discussions)
        .values({
          employmentId: input.employmentId,
          title: input.title,
          discussionDate: input.discussionDate ?? null,
          participants: input.participants ?? null,
          body: input.body ?? null,
        })
        .returning(publicDiscussionFields);
      return discussion!;
    }),

  update: publicProcedure
    .input(idInput.and(discussionMetadataSchema))
    .mutation(async ({ ctx, input }) => {
      const [discussion] = await ctx.db
        .update(discussions)
        .set({
          title: input.title,
          discussionDate: input.discussionDate ?? null,
          participants: input.participants ?? null,
          body: input.body ?? null,
          updatedAt: now(),
        })
        .where(eq(discussions.id, input.id))
        .returning(publicDiscussionFields);
      if (!discussion)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Discussion not found.",
        });
      return discussion;
    }),

  delete: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [discussion] = await ctx.db
      .delete(discussions)
      .where(eq(discussions.id, input.id))
      .returning({ id: discussions.id });
    if (!discussion)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Discussion not found.",
      });
    return discussion;
  }),
});
