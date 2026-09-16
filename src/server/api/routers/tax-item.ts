import { TRPCError } from "@trpc/server";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { buildOverview } from "~/domain/overview";
import { taxItemInput, taxItemUpdateInput } from "~/domain/tax-item";
import { businessActivities, people, records, taxDocuments, taxItems } from "~/server/db/schema";
import type { Database } from "../helpers";
import { requireActiveYear, requireHousehold } from "../helpers";
import { createTRPCRouter, publicProcedure } from "../trpc";

async function validatePerson(
  db: Database,
  householdId: number,
  personId: number | null,
) {
  if (personId === null) return;
  const person = await db.query.people.findFirst({
    where: (table, operators) =>
      operators.and(
        operators.eq(table.id, personId),
        operators.eq(table.householdId, householdId),
      ),
  });
  if (!person) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Choose a valid household member.",
    });
  }
}

async function listActiveItems(db: Database) {
  const household = await requireHousehold(db);
  const year = await requireActiveYear(db, household.id);
  const items = await db
    .select({
      id: taxItems.id,
      taxYearId: taxItems.taxYearId,
      name: taxItems.name,
      taxLineReference: taxItems.taxLineReference,
      type: taxItems.type,
      ownerKind: taxItems.ownerKind,
      personId: taxItems.personId,
      personName: people.name,
      expectedAmountCents: taxItems.expectedAmountCents,
      actualAmountCents: taxItems.actualAmountCents,
      status: taxItems.status,
      valueSource: taxItems.valueSource,
      taxTreatment: taxItems.taxTreatment,
      notes: taxItems.notes,
      createdAt: taxItems.createdAt,
      updatedAt: taxItems.updatedAt,
      businessActivityId: businessActivities.id,
    })
    .from(taxItems)
    .leftJoin(people, eq(taxItems.personId, people.id))
    .leftJoin(businessActivities, eq(taxItems.id, businessActivities.taxItemId))
    .where(eq(taxItems.taxYearId, year.id))
    .orderBy(desc(taxItems.updatedAt), desc(taxItems.id));
  return { household, year, items };
}

export const taxItemRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => listActiveItems(ctx.db)),
  get: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { year, items } = await listActiveItems(ctx.db);
      const item = items.find((candidate) => candidate.id === input.id);
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tax item not found." });
      }
      const [aggregate] = await ctx.db
        .select({ recordCount: count() })
        .from(records)
        .where(eq(records.taxItemId, item.id));
      return { year, item: { ...item, recordCount: aggregate?.recordCount ?? 0 } };
    }),
  overview: publicProcedure.query(async ({ ctx }) => {
    const { household, year, items } = await listActiveItems(ctx.db);
    return { household, year, ...buildOverview(items) };
  }),
  create: publicProcedure
    .input(taxItemInput)
    .mutation(async ({ ctx, input }) => {
      const household = await requireHousehold(ctx.db);
      const year = await requireActiveYear(ctx.db, household.id);
      await validatePerson(ctx.db, household.id, input.personId);
      const [item] = await ctx.db
        .insert(taxItems)
        .values({
          taxYearId: year.id,
          ...input,
          taxLineReference: input.taxLineReference || null,
          notes: input.notes || null,
          taxTreatment: input.taxTreatment,
        })
        .returning();
      return item;
    }),
  update: publicProcedure
    .input(taxItemUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const household = await requireHousehold(ctx.db);
      const year = await requireActiveYear(ctx.db, household.id);
      await validatePerson(ctx.db, household.id, input.personId);
      const { id, ...values } = input;
      const existing = await ctx.db.query.taxItems.findFirst({
        where: (table, operators) =>
          operators.and(
            operators.eq(table.id, id),
            operators.eq(table.taxYearId, year.id),
          ),
      });
      if (existing?.valueSource === "paycheques" || existing?.valueSource === "self_employment") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Manage this calculated item from its dedicated workspace.",
        });
      }
      const item = await ctx.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(taxItems)
          .set({
            ...values,
            actualAmountCents:
              existing?.valueSource === "records"
                ? existing.actualAmountCents
                : values.actualAmountCents,
            taxLineReference: values.taxLineReference || null,
            notes: values.notes || null,
            taxTreatment: values.taxTreatment,
          })
          .where(and(eq(taxItems.id, id), eq(taxItems.taxYearId, year.id)))
          .returning();
        if (updated?.ownerKind === "person") {
          await tx.update(records).set({ personId: updated.personId }).where(eq(records.taxItemId, updated.id));
          await tx.update(taxDocuments).set({ personId: updated.personId }).where(eq(taxDocuments.taxItemId, updated.id));
        }
        return updated;
      });
      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tax item not found.",
        });
      }
      return item;
    }),
  delete: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const household = await requireHousehold(ctx.db);
      const year = await requireActiveYear(ctx.db, household.id);
      const [item] = await ctx.db
        .select({ valueSource: taxItems.valueSource })
        .from(taxItems)
        .where(and(eq(taxItems.id, input.id), eq(taxItems.taxYearId, year.id)));
      if (item?.valueSource === "paycheques" || item?.valueSource === "self_employment") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Delete this calculated item from its dedicated workspace.",
        });
      }
      const [deleted] = await ctx.db
        .delete(taxItems)
        .where(
          and(eq(taxItems.id, input.id), eq(taxItems.taxYearId, year.id)),
        )
        .returning({ id: taxItems.id });
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tax item not found.",
        });
      }
      return { success: true };
    }),
});
