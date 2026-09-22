import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { people } from "~/server/db/schema";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const personInput = z.object({
  displayName: z.string().trim().min(1).max(120),
});

const idInput = z.object({ id: z.string().uuid() });
const now = () => new Date().toISOString();

export const peopleRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.people.findMany({
      orderBy: [asc(people.sortOrder), asc(people.displayName)],
    });
  }),

  create: publicProcedure.input(personInput).mutation(async ({ ctx, input }) => {
    const household = await ctx.db.query.households.findFirst();
    if (!household) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Set up Passbook first." });
    }

    const existing = await ctx.db.query.people.findMany({
      where: eq(people.householdId, household.id),
    });

    const [person] = await ctx.db
      .insert(people)
      .values({
        householdId: household.id,
        displayName: input.displayName,
        sortOrder: existing.length,
      })
      .returning();

    return person;
  }),

  update: publicProcedure
    .input(idInput.and(personInput))
    .mutation(async ({ ctx, input }) => {
      const [person] = await ctx.db
        .update(people)
        .set({ displayName: input.displayName, updatedAt: now() })
        .where(eq(people.id, input.id))
        .returning();
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });
      return person;
    }),

  delete: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [person] = await ctx.db
      .delete(people)
      .where(eq(people.id, input.id))
      .returning({ id: people.id });
    if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });
    return person;
  }),
});
