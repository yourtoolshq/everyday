import { TRPCError } from "@trpc/server";
import { and, count, eq, max } from "drizzle-orm";
import { z } from "zod";

import { households, people, records, taxItems } from "~/server/db/schema";
import { getSettings, requireHousehold } from "../helpers";
import { createTRPCRouter, publicProcedure } from "../trpc";

const nameInput = z.string().trim().min(1).max(100);

export const settingsRouter = createTRPCRouter({
  get: publicProcedure.query(({ ctx }) => getSettings(ctx.db)),
  renameHousehold: publicProcedure.input(z.object({ name: nameInput })).mutation(async ({ ctx, input }) => {
    const household = await requireHousehold(ctx.db);
    await ctx.db.update(households).set({ name: input.name }).where(eq(households.id, household.id));
    return { success: true };
  }),
  addPerson: publicProcedure.input(z.object({ name: nameInput })).mutation(async ({ ctx, input }) => {
    const household = await requireHousehold(ctx.db);
    const [row] = await ctx.db.select({ value: max(people.sortOrder) }).from(people).where(eq(people.householdId, household.id));
    const [person] = await ctx.db.insert(people).values({
      householdId: household.id,
      name: input.name,
      sortOrder: (row?.value ?? -1) + 1,
    }).returning();
    return person;
  }),
  renamePerson: publicProcedure.input(z.object({ id: z.number().int().positive(), name: nameInput })).mutation(async ({ ctx, input }) => {
    const household = await requireHousehold(ctx.db);
    const result = await ctx.db.update(people).set({ name: input.name })
      .where(and(eq(people.id, input.id), eq(people.householdId, household.id))).returning({ id: people.id });
    if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found." });
    return { success: true };
  }),
  deletePerson: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const household = await requireHousehold(ctx.db);
    const [householdSize] = await ctx.db.select({ value: count() }).from(people).where(eq(people.householdId, household.id));
    if ((householdSize?.value ?? 0) <= 1) {
      throw new TRPCError({ code: "CONFLICT", message: "A household must have at least one person." });
    }
    const [[itemReferences], [recordReferences]] = await Promise.all([
      ctx.db.select({ value: count() }).from(taxItems).where(eq(taxItems.personId, input.id)),
      ctx.db.select({ value: count() }).from(records).where(eq(records.personId, input.id)),
    ]);
    if ((itemReferences?.value ?? 0) > 0 || (recordReferences?.value ?? 0) > 0) {
      throw new TRPCError({ code: "CONFLICT", message: "This person is referenced by tax information and cannot be removed." });
    }
    const result = await ctx.db.delete(people)
      .where(and(eq(people.id, input.id), eq(people.householdId, household.id))).returning({ id: people.id });
    if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found." });
    return { success: true };
  }),
});
