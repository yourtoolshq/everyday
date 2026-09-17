import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { taxYearStatuses } from "~/domain/filing";
import { taxYears } from "~/server/db/schema";
import { updateTaxYearStatus } from "../filing-values";
import { requireHousehold } from "../helpers";
import { createTRPCRouter, publicProcedure } from "../trpc";

const yearSchema = z.number().int().min(2000).max(2100);

export const taxYearRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    const household = await requireHousehold(ctx.db);
    return ctx.db.select().from(taxYears).where(eq(taxYears.householdId, household.id)).orderBy(asc(taxYears.year));
  }),
  create: publicProcedure.input(z.object({ year: yearSchema })).mutation(async ({ ctx, input }) => {
    const household = await requireHousehold(ctx.db);
    const existing = await ctx.db.query.taxYears.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.householdId, household.id),
        operators.eq(table.year, input.year),
      ),
    });
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "That tax year already exists." });
    return ctx.db.transaction(async (tx) => {
      await tx.update(taxYears).set({ isActive: false }).where(eq(taxYears.householdId, household.id));
      const [year] = await tx.insert(taxYears).values({ householdId: household.id, year: input.year, isActive: true }).returning();
      return year;
    });
  }),
  createPast: publicProcedure.input(z.object({ year: yearSchema })).mutation(async ({ ctx, input }) => {
    const household = await requireHousehold(ctx.db);
    const existing = await ctx.db.query.taxYears.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.householdId, household.id),
        operators.eq(table.year, input.year),
      ),
    });
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "That tax year already exists." });
    const [year] = await ctx.db
      .insert(taxYears)
      .values({ householdId: household.id, year: input.year, isActive: false })
      .returning();
    return year;
  }),
  updateStatus: publicProcedure
    .input(z.object({
      id: z.number().int().positive(),
      status: z.enum(taxYearStatuses),
      acknowledgeWarnings: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) =>
      updateTaxYearStatus(
        ctx.db,
        input.id,
        input.status,
        input.acknowledgeWarnings ?? false,
      ),
    ),
  setActive: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const household = await requireHousehold(ctx.db);
    const target = await ctx.db.query.taxYears.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.id, input.id),
        operators.eq(table.householdId, household.id),
      ),
    });
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Tax year not found." });
    await ctx.db.transaction(async (tx) => {
      await tx.update(taxYears).set({ isActive: false }).where(eq(taxYears.householdId, household.id));
      await tx.update(taxYears).set({ isActive: true })
        .where(and(eq(taxYears.id, input.id), eq(taxYears.householdId, household.id)));
    });
    return { success: true };
  }),
});
