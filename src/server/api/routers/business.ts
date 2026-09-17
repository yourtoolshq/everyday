import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { businessActivityInput, businessActivityUpdateInput } from "~/domain/self-employment";
import { businessActivities, people, taxItems } from "~/server/db/schema";
import { listBusinessActivities, listBusinessRecords } from "../business-values";
import { requireEditableActiveYear, requireHousehold } from "../helpers";
import { createTRPCRouter, publicProcedure } from "../trpc";

async function requirePerson(db: Parameters<typeof requireHousehold>[0], householdId: number, personId: number) {
  const [person] = await db.select({ id: people.id }).from(people).where(and(eq(people.id, personId), eq(people.householdId, householdId)));
  if (!person) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid household member." });
}
export const businessRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => listBusinessActivities(ctx.db)),
  records: publicProcedure.input(z.object({ businessActivityId: z.number().int().positive() })).query(({ ctx, input }) => listBusinessRecords(ctx.db, input.businessActivityId)),
  create: publicProcedure.input(businessActivityInput).mutation(async ({ ctx, input }) => {
    const household = await requireHousehold(ctx.db); const year = await requireEditableActiveYear(ctx.db, household.id); await requirePerson(ctx.db, household.id, input.personId);
    return ctx.db.transaction(async (tx) => { const [item] = await tx.insert(taxItems).values({ taxYearId: year.id, name: `Net business income (loss) — ${input.name}`, taxLineReference: "T2125 9946 → 13500", type: "income", ownerKind: "person", personId: input.personId, expectedAmountCents: null, actualAmountCents: 0, status: "in_progress", valueSource: "self_employment", taxTreatment: "self_employment_income", notes: null }).returning(); const [activity] = await tx.insert(businessActivities).values({ taxYearId: year.id, taxItemId: item!.id, ...input }).returning(); return activity!; });
  }),
  update: publicProcedure.input(businessActivityUpdateInput).mutation(async ({ ctx, input }) => {
    const household = await requireHousehold(ctx.db); const year = await requireEditableActiveYear(ctx.db, household.id); await requirePerson(ctx.db, household.id, input.personId); const { id, ...values } = input;
    return ctx.db.transaction(async (tx) => { const [activity] = await tx.update(businessActivities).set(values).where(and(eq(businessActivities.id, id), eq(businessActivities.taxYearId, year.id))).returning(); if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "Self-employment business not found." }); await tx.update(taxItems).set({ name: `Net business income (loss) — ${input.name}`, personId: input.personId }).where(eq(taxItems.id, activity.taxItemId)); return activity; });
  }),
  delete: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const household = await requireHousehold(ctx.db); const year = await requireEditableActiveYear(ctx.db, household.id); const [activity] = await ctx.db.select({ taxItemId: businessActivities.taxItemId }).from(businessActivities).where(and(eq(businessActivities.id, input.id), eq(businessActivities.taxYearId, year.id))); if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "Self-employment business not found." }); await ctx.db.delete(taxItems).where(eq(taxItems.id, activity.taxItemId)); return { success: true };
  }),
});
