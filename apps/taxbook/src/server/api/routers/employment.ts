import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  employmentDeductionSettings,
  employmentInput,
  employmentUpdateInput,
} from "~/domain/employment";
import {
  employments,
  people,
  taxItems,
} from "~/server/db/schema";
import { employmentProjection, reconcileEmploymentLinkedTaxItems, syncEmploymentTaxItem, deleteEmploymentTaxItems } from "../employment-values";
import type { Database } from "../helpers";
import { requireActiveYear, requireEditableActiveYear, requireHousehold } from "../helpers";
import { createTRPCRouter, publicProcedure } from "../trpc";

async function requirePerson(db: Database, householdId: number, personId: number) {
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
  return person;
}

function validateEndDate(endDate: string | null, year: number) {
  if (endDate !== null && Number(endDate.slice(0, 4)) !== year) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `The end date must be in the ${year} tax year.`,
    });
  }
}

export const employmentRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    const household = await requireHousehold(ctx.db);
    const year = await requireActiveYear(ctx.db, household.id);
    const rows = await ctx.db
      .select({
        id: employments.id,
        taxYearId: employments.taxYearId,
        personId: employments.personId,
        personName: people.name,
        taxItemId: employments.taxItemId,
        employerName: employments.employerName,
        payFrequency: employments.payFrequency,
        status: employments.status,
        endDate: employments.endDate,
        typicalGrossOverrideCents: employments.typicalGrossOverrideCents,
        incomeTaxEnabled: employments.incomeTaxEnabled,
        federalIncomeTaxEnabled: employments.federalIncomeTaxEnabled,
        manitobaIncomeTaxEnabled: employments.manitobaIncomeTaxEnabled,
        deductionFieldOrder: employments.deductionFieldOrder,
        cppEnabled: employments.cppEnabled,
        cpp2Enabled: employments.cpp2Enabled,
        eiEnabled: employments.eiEnabled,
        wiEnabled: employments.wiEnabled,
        ltdEnabled: employments.ltdEnabled,
        extendedHealthEnabled: employments.extendedHealthEnabled,
        travelMedicalEnabled: employments.travelMedicalEnabled,
        unionDuesEnabled: employments.unionDuesEnabled,
        phspReportedOnT4: employments.phspReportedOnT4,
        unionDuesReportedOnT4: employments.unionDuesReportedOnT4,
        phspTaxItemId: employments.phspTaxItemId,
        unionDuesTaxItemId: employments.unionDuesTaxItemId,
        otherDeductionsEnabled: employments.otherDeductionsEnabled,
        tenureEmploymentId: employments.tenureEmploymentId,
        createdAt: employments.createdAt,
        updatedAt: employments.updatedAt,
      })
      .from(employments)
      .innerJoin(people, eq(employments.personId, people.id))
      .where(eq(employments.taxYearId, year.id))
      .orderBy(asc(people.sortOrder), asc(employments.id));
    const items = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        projection: await employmentProjection(ctx.db, row.id),
      })),
    );
    return {
      year,
      items,
      showPaychequesWorkspace:
        items.length === 0 || items.some((item) => !item.tenureEmploymentId),
    };
  }),
  create: publicProcedure
    .input(employmentInput)
    .mutation(async ({ ctx, input }) => {
      const household = await requireHousehold(ctx.db);
      const year = await requireEditableActiveYear(ctx.db, household.id);
      await requirePerson(ctx.db, household.id, input.personId);
      validateEndDate(input.endDate, year.year);
      return ctx.db.transaction(async (tx) => {
        const [taxItem] = await tx
          .insert(taxItems)
          .values({
            taxYearId: year.id,
            name: `Employment income — ${input.employerName}`,
            taxLineReference: "10100",
            type: "income",
            ownerKind: "person",
            personId: input.personId,
            expectedAmountCents: 0,
            actualAmountCents: 0,
            status: "in_progress",
            valueSource: "paycheques",
            taxTreatment: "employment_income",
            notes: null,
          })
          .returning();
        const [employment] = await tx
          .insert(employments)
          .values({
            taxYearId: year.id,
            taxItemId: taxItem!.id,
            ...employmentDeductionSettings(input),
          })
          .returning();
        const linked = await reconcileEmploymentLinkedTaxItems(tx, employment!, {
          employerName: input.employerName,
          personId: input.personId,
          phspReportedOnT4: input.phspReportedOnT4,
          unionDuesReportedOnT4: input.unionDuesReportedOnT4,
        });
        await syncEmploymentTaxItem(tx, linked.id);
        return linked;
      });
    }),
  update: publicProcedure
    .input(employmentUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const household = await requireHousehold(ctx.db);
      const year = await requireEditableActiveYear(ctx.db, household.id);
      await requirePerson(ctx.db, household.id, input.personId);
      validateEndDate(input.endDate, year.year);
      const { id, ...values } = employmentDeductionSettings(input);
      return ctx.db.transaction(async (tx) => {
        const [employment] = await tx
          .update(employments)
          .set(values)
          .where(and(eq(employments.id, id), eq(employments.taxYearId, year.id)))
          .returning();
        if (!employment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Employment not found.",
          });
        }
        await tx
          .update(taxItems)
          .set({
            name: `Employment income — ${input.employerName}`,
            personId: input.personId,
          })
          .where(eq(taxItems.id, employment.taxItemId));
        const linked = await reconcileEmploymentLinkedTaxItems(tx, employment, {
          employerName: input.employerName,
          personId: input.personId,
          phspReportedOnT4: input.phspReportedOnT4,
          unionDuesReportedOnT4: input.unionDuesReportedOnT4,
        });
        await syncEmploymentTaxItem(tx, linked.id);
        return linked;
      });
    }),
  delete: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const household = await requireHousehold(ctx.db);
      const year = await requireEditableActiveYear(ctx.db, household.id);
      const [employment] = await ctx.db
        .select({
          taxItemId: employments.taxItemId,
          phspTaxItemId: employments.phspTaxItemId,
          unionDuesTaxItemId: employments.unionDuesTaxItemId,
        })
        .from(employments)
        .where(
          and(
            eq(employments.id, input.id),
            eq(employments.taxYearId, year.id),
          ),
        );
      if (!employment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Employment not found.",
        });
      }
      await ctx.db.transaction(async (tx) => {
        await tx.delete(employments).where(eq(employments.id, input.id));
        await deleteEmploymentTaxItems(tx, employment);
      });
      return { success: true };
    }),
});
