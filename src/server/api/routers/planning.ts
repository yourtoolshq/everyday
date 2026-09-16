import { TRPCError } from "@trpc/server";
import { asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  careItemFieldsSchema,
  careItemSortKey,
  careStatuses,
  personNameSchema,
  planYearSchema,
} from "~/lib/care-planning";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { careItems, carePlans, people } from "~/server/db/schema";

const idInput = z.object({ id: z.string().uuid() });
const now = () => new Date().toISOString();

function databaseConflict(error: unknown, message: string): never {
  if (error instanceof Error && /unique|constraint/i.test(error.message)) {
    throw new TRPCError({ code: "CONFLICT", message, cause: error });
  }
  throw error;
}

export const planningRouter = createTRPCRouter({
  overview: publicProcedure
    .input(z.object({ planId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const [allPeople, plans, assignmentCounts] = await Promise.all([
        ctx.db.select().from(people).orderBy(asc(people.createdAt)),
        ctx.db.select().from(carePlans).orderBy(desc(carePlans.year)),
        ctx.db
          .select({ personId: careItems.personId, total: count() })
          .from(careItems)
          .groupBy(careItems.personId),
      ]);
      const totalsByPerson = new Map(
        assignmentCounts.map(({ personId, total }) => [personId, total]),
      );

      const selectedPlan = input?.planId
        ? (plans.find((plan) => plan.id === input.planId) ?? null)
        : (plans.find((plan) => plan.year === new Date().getFullYear()) ??
          plans[0] ??
          null);

      const items = selectedPlan
        ? await ctx.db
            .select()
            .from(careItems)
            .where(eq(careItems.planId, selectedPlan.id))
        : [];

      items.sort((a, b) => {
        const timing = careItemSortKey(a) - careItemSortKey(b);
        return timing || a.title.localeCompare(b.title);
      });

      return {
        people: allPeople.map((person) => ({
          ...person,
          careItemCount: totalsByPerson.get(person.id) ?? 0,
        })),
        plans,
        selectedPlan,
        items,
      };
    }),

  createPerson: publicProcedure
    .input(z.object({ displayName: personNameSchema }))
    .mutation(async ({ ctx, input }) => {
      const [person] = await ctx.db.insert(people).values(input).returning();
      return person!;
    }),

  updatePerson: publicProcedure
    .input(z.object({ id: z.string().uuid(), displayName: personNameSchema }))
    .mutation(async ({ ctx, input }) => {
      const [person] = await ctx.db
        .update(people)
        .set({ displayName: input.displayName, updatedAt: now() })
        .where(eq(people.id, input.id))
        .returning();
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Household member not found" });
      return person;
    }),

  deletePerson: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const assignmentCounts = await ctx.db
      .select({ total: count() })
      .from(careItems)
      .where(eq(careItems.personId, input.id));
    const total = assignmentCounts[0]?.total ?? 0;
    if (total > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Reassign or remove this person’s care items before deleting them.",
      });
    }
    const [person] = await ctx.db.delete(people).where(eq(people.id, input.id)).returning();
    if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Household member not found" });
    return person;
  }),

  createPlan: publicProcedure
    .input(z.object({ year: planYearSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [plan] = await ctx.db.insert(carePlans).values(input).returning();
        return plan!;
      } catch (error) {
        databaseConflict(error, `A care plan for ${input.year} already exists.`);
      }
    }),

  updatePlan: publicProcedure
    .input(z.object({ id: z.string().uuid(), year: planYearSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [plan] = await ctx.db
          .update(carePlans)
          .set({ year: input.year, updatedAt: now() })
          .where(eq(carePlans.id, input.id))
          .returning();
        if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Care plan not found" });
        return plan;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        databaseConflict(error, `A care plan for ${input.year} already exists.`);
      }
    }),

  deletePlan: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [plan] = await ctx.db.delete(carePlans).where(eq(carePlans.id, input.id)).returning();
    if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Care plan not found" });
    return plan;
  }),

  createItem: publicProcedure
    .input(careItemFieldsSchema.and(z.object({ planId: z.string().uuid() })))
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db.insert(careItems).values(input).returning();
      return item!;
    }),

  updateItem: publicProcedure
    .input(careItemFieldsSchema.and(z.object({ id: z.string().uuid() })))
    .mutation(async ({ ctx, input }) => {
      const { id, ...changes } = input;
      const [item] = await ctx.db
        .update(careItems)
        .set({ ...changes, updatedAt: now() })
        .where(eq(careItems.id, id))
        .returning();
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Care item not found" });
      return item;
    }),

  updateItemStatus: publicProcedure
    .input(z.object({ id: z.string().uuid(), status: z.enum(careStatuses) }))
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db
        .update(careItems)
        .set({ status: input.status, updatedAt: now() })
        .where(eq(careItems.id, input.id))
        .returning();
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Care item not found" });
      return item;
    }),

  deleteItem: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [item] = await ctx.db.delete(careItems).where(eq(careItems.id, input.id)).returning();
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Care item not found" });
    return item;
  }),
});
