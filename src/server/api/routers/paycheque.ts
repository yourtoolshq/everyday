import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  calculateNetPay,
  paychequeInput,
  paychequeUpdateInput,
} from "~/domain/employment";
import { employments, paycheques, people } from "~/server/db/schema";
import { syncEmploymentTaxItem } from "../employment-values";
import { requireActiveYear, requireEditableActiveYear, requireHousehold } from "../helpers";
import { createTRPCRouter, publicProcedure } from "../trpc";

async function requireEmployment(
  db: typeof import("~/server/db").db,
  employmentId: number,
  taxYearId: number,
) {
  const employment = await db.query.employments.findFirst({
    where: (table, operators) =>
      operators.and(
        operators.eq(table.id, employmentId),
        operators.eq(table.taxYearId, taxYearId),
      ),
  });
  if (!employment) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Choose a valid employment for this tax year.",
    });
  }
  return employment;
}

function validatePayDate(payDate: string, year: number) {
  if (Number(payDate.slice(0, 4)) !== year) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `The pay date must be in the ${year} tax year.`,
    });
  }
}

export const paychequeRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    const household = await requireHousehold(ctx.db);
    const year = await requireActiveYear(ctx.db, household.id);
    const items = await ctx.db
      .select({
        id: paycheques.id,
        employmentId: paycheques.employmentId,
        payDate: paycheques.payDate,
        grossPayCents: paycheques.grossPayCents,
        incomeTaxCents: paycheques.incomeTaxCents,
        cppCents: paycheques.cppCents,
        cpp2Cents: paycheques.cpp2Cents,
        eiCents: paycheques.eiCents,
        wiCents: paycheques.wiCents,
        ltdCents: paycheques.ltdCents,
        extendedHealthCents: paycheques.extendedHealthCents,
        travelMedicalCents: paycheques.travelMedicalCents,
        unionDuesCents: paycheques.unionDuesCents,
        otherDeductionsCents: paycheques.otherDeductionsCents,
        netPayCents: paycheques.netPayCents,
        personId: employments.personId,
        personName: people.name,
        employerName: employments.employerName,
        createdAt: paycheques.createdAt,
        updatedAt: paycheques.updatedAt,
      })
      .from(paycheques)
      .innerJoin(employments, eq(paycheques.employmentId, employments.id))
      .innerJoin(people, eq(employments.personId, people.id))
      .where(eq(employments.taxYearId, year.id))
      .orderBy(desc(paycheques.payDate), desc(paycheques.id));
    return { year, items };
  }),
  create: publicProcedure
    .input(paychequeInput)
    .mutation(async ({ ctx, input }) => {
      const household = await requireHousehold(ctx.db);
      const year = await requireEditableActiveYear(ctx.db, household.id);
      await requireEmployment(ctx.db, input.employmentId, year.id);
      validatePayDate(input.payDate, year.year);
      return ctx.db.transaction(async (tx) => {
        const [paycheque] = await tx
          .insert(paycheques)
          .values({ ...input, netPayCents: calculateNetPay(input) })
          .returning();
        await syncEmploymentTaxItem(tx, input.employmentId);
        return paycheque;
      });
    }),
  update: publicProcedure
    .input(paychequeUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const household = await requireHousehold(ctx.db);
      const year = await requireEditableActiveYear(ctx.db, household.id);
      await requireEmployment(ctx.db, input.employmentId, year.id);
      validatePayDate(input.payDate, year.year);
      const { id, ...values } = input;
      return ctx.db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ employmentId: paycheques.employmentId })
          .from(paycheques)
          .innerJoin(employments, eq(paycheques.employmentId, employments.id))
          .where(
            and(eq(paycheques.id, id), eq(employments.taxYearId, year.id)),
          );
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Paycheque not found.",
          });
        }
        const [paycheque] = await tx
          .update(paycheques)
          .set({ ...values, netPayCents: calculateNetPay(values) })
          .where(eq(paycheques.id, id))
          .returning();
        await syncEmploymentTaxItem(tx, existing.employmentId);
        if (existing.employmentId !== input.employmentId) {
          await syncEmploymentTaxItem(tx, input.employmentId);
        }
        return paycheque;
      });
    }),
  delete: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const household = await requireHousehold(ctx.db);
      const year = await requireEditableActiveYear(ctx.db, household.id);
      return ctx.db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ employmentId: paycheques.employmentId })
          .from(paycheques)
          .innerJoin(employments, eq(paycheques.employmentId, employments.id))
          .where(
            and(
              eq(paycheques.id, input.id),
              eq(employments.taxYearId, year.id),
            ),
          );
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Paycheque not found.",
          });
        }
        await tx.delete(paycheques).where(eq(paycheques.id, input.id));
        await syncEmploymentTaxItem(tx, existing.employmentId);
        return { success: true };
      });
    }),
});
