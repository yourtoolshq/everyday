import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  deriveExpectedPayPeriodsForYear,
  paycheckMatchesPeriod,
} from "~/lib/expected-pay-periods";
import {
  applyPaycheckIncomeTax,
  calculateNetPay,
  isIncomeTaxSplit,
  parseDeductionSettings,
  paycheckInput,
} from "~/lib/paycheck-deductions";
import {
  buildPaycheckImportPreview,
  detectPaycheckColumnMapping,
  paycheckImportRowToInput,
  type PaycheckColumnMapping,
} from "~/lib/paycheck-csv-import";
import {
  buildExceptionsByEmployment,
  buildMissingPayStubItems,
  countPayCompletenessForYear,
  derivePayStubCompleteness,
} from "~/lib/pay-stub-completeness";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  documents,
  employments,
  employers,
  payPeriodExceptions,
  paychecks,
  people,
} from "~/server/db/schema";

const idInput = z.object({ id: z.string().uuid() });
const employmentIdInput = z.object({ employmentId: z.string().uuid() });
const now = () => new Date().toISOString();

function buildPaycheckValues(
  input: z.infer<typeof paycheckInput>,
  deductionSettings: ReturnType<typeof parseDeductionSettings>,
) {
  const split = isIncomeTaxSplit(deductionSettings);
  const amounts = applyPaycheckIncomeTax(
    {
      grossPayCents: input.grossPayCents,
      incomeTaxCents: input.incomeTaxCents,
      federalIncomeTaxCents: input.federalIncomeTaxCents,
      manitobaIncomeTaxCents: input.manitobaIncomeTaxCents,
      cppCents: input.cppCents,
      cpp2Cents: input.cpp2Cents,
      eiCents: input.eiCents,
      wiCents: input.wiCents,
      ltdCents: input.ltdCents,
      extendedHealthCents: input.extendedHealthCents,
      travelMedicalCents: input.travelMedicalCents,
      unionDuesCents: input.unionDuesCents,
      otherDeductionsCents: input.otherDeductionsCents,
    },
    split,
  );

  return {
    ...amounts,
    netPayCents: calculateNetPay(amounts),
    payDate: input.payDate,
    periodStartDate: input.periodStartDate,
    periodEndDate: input.periodEndDate,
  };
}

async function getEmploymentPaySettings(ctx: { db: typeof import("~/server/db").db }, employmentId: string) {
  const [employment] = await ctx.db
    .select({
      id: employments.id,
      deductionSettings: employments.deductionSettings,
    })
    .from(employments)
    .where(eq(employments.id, employmentId));

  if (!employment) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Employment not found." });
  }

  return parseDeductionSettings(employment.deductionSettings);
}

export const paychecksRouter = createTRPCRouter({
  listByEmployment: publicProcedure.input(employmentIdInput).query(async ({ ctx, input }) => {
    return ctx.db
      .select({
        id: paychecks.id,
        employmentId: paychecks.employmentId,
        payDate: paychecks.payDate,
        periodStartDate: paychecks.periodStartDate,
        periodEndDate: paychecks.periodEndDate,
        grossPayCents: paychecks.grossPayCents,
        incomeTaxCents: paychecks.incomeTaxCents,
        federalIncomeTaxCents: paychecks.federalIncomeTaxCents,
        manitobaIncomeTaxCents: paychecks.manitobaIncomeTaxCents,
        cppCents: paychecks.cppCents,
        cpp2Cents: paychecks.cpp2Cents,
        eiCents: paychecks.eiCents,
        wiCents: paychecks.wiCents,
        ltdCents: paychecks.ltdCents,
        extendedHealthCents: paychecks.extendedHealthCents,
        travelMedicalCents: paychecks.travelMedicalCents,
        unionDuesCents: paychecks.unionDuesCents,
        otherDeductionsCents: paychecks.otherDeductionsCents,
        netPayCents: paychecks.netPayCents,
        documentId: paychecks.documentId,
        documentTitle: documents.title,
        documentFilename: documents.originalFilename,
        createdAt: paychecks.createdAt,
        updatedAt: paychecks.updatedAt,
      })
      .from(paychecks)
      .leftJoin(documents, eq(paychecks.documentId, documents.id))
      .where(eq(paychecks.employmentId, input.employmentId))
      .orderBy(desc(paychecks.payDate), desc(paychecks.createdAt));
  }),

  previewImport: publicProcedure
    .input(
      z.object({
        employmentId: z.string().uuid(),
        csvText: z.string().min(1),
        mapping: z.record(z.string(), z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [employment] = await ctx.db
        .select({
          id: employments.id,
          status: employments.status,
          startDate: employments.startDate,
          endDate: employments.endDate,
          payFrequency: employments.payFrequency,
          biweeklyAnchorDate: employments.biweeklyAnchorDate,
        })
        .from(employments)
        .where(eq(employments.id, input.employmentId));

      if (!employment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employment not found." });
      }

      const existingPaychecks = await ctx.db
        .select({
          payDate: paychecks.payDate,
          grossPayCents: paychecks.grossPayCents,
        })
        .from(paychecks)
        .where(eq(paychecks.employmentId, input.employmentId));

      const mapping = (input.mapping ?? detectPaycheckColumnMapping(
        input.csvText.trim().split(/\r?\n/)[0]?.split(",") ?? [],
      )) as PaycheckColumnMapping;

      return buildPaycheckImportPreview({
        csvText: input.csvText,
        mapping,
        lifecycle: employment,
        payFrequency: employment.payFrequency,
        biweeklyAnchorDate: employment.biweeklyAnchorDate,
        existingPaychecks,
      });
    }),

  import: publicProcedure
    .input(
      z.object({
        employmentId: z.string().uuid(),
        csvText: z.string().min(1),
        mapping: z.record(z.string(), z.string()).optional(),
        skipDuplicates: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [employment] = await ctx.db
        .select({
          id: employments.id,
          status: employments.status,
          startDate: employments.startDate,
          endDate: employments.endDate,
          payFrequency: employments.payFrequency,
          biweeklyAnchorDate: employments.biweeklyAnchorDate,
          deductionSettings: employments.deductionSettings,
        })
        .from(employments)
        .where(eq(employments.id, input.employmentId));

      if (!employment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employment not found." });
      }

      const existingPaychecks = await ctx.db
        .select({
          payDate: paychecks.payDate,
          grossPayCents: paychecks.grossPayCents,
        })
        .from(paychecks)
        .where(eq(paychecks.employmentId, input.employmentId));

      const mapping = (input.mapping ?? detectPaycheckColumnMapping(
        input.csvText.trim().split(/\r?\n/)[0]?.split(",") ?? [],
      )) as PaycheckColumnMapping;

      const preview = buildPaycheckImportPreview({
        csvText: input.csvText,
        mapping,
        lifecycle: employment,
        payFrequency: employment.payFrequency,
        biweeklyAnchorDate: employment.biweeklyAnchorDate,
        existingPaychecks,
      });

      const settings = parseDeductionSettings(employment.deductionSettings);
      const rowsToImport = preview.rows.filter((row) => {
        if (row.errors.length > 0) return false;
        if (input.skipDuplicates && row.isDuplicate) return false;
        return true;
      });

      const created = await ctx.db.transaction(async (tx) => {
        const inserted = [];
        for (const row of rowsToImport) {
          const parsed = paycheckImportRowToInput(input.employmentId, row);
          const values = buildPaycheckValues(parsed, settings);
          const [paycheck] = await tx
            .insert(paychecks)
            .values({
              employmentId: input.employmentId,
              ...values,
            })
            .returning();
          if (paycheck) inserted.push(paycheck);
        }
        return inserted;
      });

      return {
        importedCount: created.length,
        skippedDuplicateCount: preview.rows.filter((row) => row.isDuplicate).length,
        skippedErrorCount: preview.errorCount,
        estimatedPeriodCount: preview.estimatedPeriodCount,
      };
    }),

  create: publicProcedure.input(paycheckInput).mutation(async ({ ctx, input }) => {
    const settings = await getEmploymentPaySettings(ctx, input.employmentId);
    const values = buildPaycheckValues(input, settings);

    const [paycheck] = await ctx.db
      .insert(paychecks)
      .values({
        employmentId: input.employmentId,
        ...values,
      })
      .returning();

    if (!paycheck) throw new Error("Paycheck creation failed.");
    return paycheck;
  }),

  update: publicProcedure
    .input(idInput.and(paycheckInput))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: paychecks.id, employmentId: paychecks.employmentId })
        .from(paychecks)
        .where(eq(paychecks.id, input.id));

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Paycheck not found." });
      }
      if (existing.employmentId !== input.employmentId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Paycheck employment cannot be changed.",
        });
      }

      const settings = await getEmploymentPaySettings(ctx, input.employmentId);
      const values = buildPaycheckValues(input, settings);

      const [paycheck] = await ctx.db
        .update(paychecks)
        .set({
          ...values,
          updatedAt: now(),
        })
        .where(eq(paychecks.id, input.id))
        .returning();

      if (!paycheck) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Paycheck not found." });
      }
      return paycheck;
    }),

  delete: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [paycheck] = await ctx.db
      .delete(paychecks)
      .where(eq(paychecks.id, input.id))
      .returning({ id: paychecks.id });
    if (!paycheck) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Paycheck not found." });
    }
    return paycheck;
  }),

  periodCompleteness: publicProcedure
    .input(
      z.object({
        employmentId: z.string().uuid(),
        year: z.number().int().min(1970).max(2100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [employment] = await ctx.db
        .select({
          id: employments.id,
          status: employments.status,
          startDate: employments.startDate,
          endDate: employments.endDate,
          payFrequency: employments.payFrequency,
          biweeklyAnchorDate: employments.biweeklyAnchorDate,
        })
        .from(employments)
        .where(eq(employments.id, input.employmentId));

      if (!employment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employment not found." });
      }

      const paycheckRows = await ctx.db
        .select({
          id: paychecks.id,
          periodStartDate: paychecks.periodStartDate,
          periodEndDate: paychecks.periodEndDate,
          documentId: paychecks.documentId,
        })
        .from(paychecks)
        .where(eq(paychecks.employmentId, input.employmentId));

      const exceptionRows = await ctx.db
        .select({
          employmentId: payPeriodExceptions.employmentId,
          periodKey: payPeriodExceptions.periodKey,
        })
        .from(payPeriodExceptions)
        .where(eq(payPeriodExceptions.employmentId, input.employmentId));

      const exceptions = buildExceptionsByEmployment(exceptionRows)[employment.id] ?? {};
      const paychecksForCompleteness = paycheckRows.map((row) => ({
        id: row.id,
        periodStartDate: row.periodStartDate,
        periodEndDate: row.periodEndDate,
        hasStub: row.documentId !== null,
      }));

      const periods = deriveExpectedPayPeriodsForYear(
        employment,
        employment.payFrequency,
        input.year,
        employment.biweeklyAnchorDate,
      );

      const summary = countPayCompletenessForYear(
        periods,
        paychecksForCompleteness,
        employment.payFrequency,
        exceptions,
      );

      const periodStatuses = periods.map((period) => {
        const matchedPaychecks = paycheckRows.filter((paycheck) =>
          paycheckMatchesPeriod(
            employment.payFrequency,
            period,
            paycheck.periodStartDate,
            paycheck.periodEndDate,
          ),
        );

        return {
          ...period,
          completeness: derivePayStubCompleteness(
            period,
            paychecksForCompleteness,
            employment.payFrequency,
            Boolean(exceptions[period.key]),
          ),
          paycheckCount: matchedPaychecks.length,
          paychecks: matchedPaychecks.map((paycheck) => ({
            id: paycheck.id,
            hasStub: paycheck.documentId !== null,
            documentId: paycheck.documentId,
          })),
        };
      });

      return {
        summary,
        periods: periodStatuses,
      };
    }),

  markPeriodNotApplicable: publicProcedure
    .input(
      z.object({
        employmentId: z.string().uuid(),
        periodKey: z.string().trim().min(1).max(32),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [employment] = await ctx.db
        .select({ id: employments.id })
        .from(employments)
        .where(eq(employments.id, input.employmentId));
      if (!employment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employment not found." });
      }

      await ctx.db
        .insert(payPeriodExceptions)
        .values({
          employmentId: input.employmentId,
          periodKey: input.periodKey,
        })
        .onConflictDoNothing();

      return { employmentId: input.employmentId, periodKey: input.periodKey };
    }),

  removePeriodException: publicProcedure
    .input(
      z.object({
        employmentId: z.string().uuid(),
        periodKey: z.string().trim().min(1).max(32),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(payPeriodExceptions)
        .where(
          and(
            eq(payPeriodExceptions.employmentId, input.employmentId),
            eq(payPeriodExceptions.periodKey, input.periodKey),
          ),
        );
      return input;
    }),

  listForReview: publicProcedure.query(async ({ ctx }) => {
    const employmentRows = await ctx.db
      .select({
        id: employments.id,
        employerName: employers.name,
        personName: people.displayName,
        status: employments.status,
        startDate: employments.startDate,
        endDate: employments.endDate,
        payFrequency: employments.payFrequency,
        biweeklyAnchorDate: employments.biweeklyAnchorDate,
      })
      .from(employments)
      .innerJoin(employers, eq(employments.employerId, employers.id))
      .innerJoin(people, eq(employments.personId, people.id))
      .orderBy(asc(employers.name), asc(people.displayName));

    const paycheckRows = await ctx.db
      .select({
        employmentId: paychecks.employmentId,
        id: paychecks.id,
        periodStartDate: paychecks.periodStartDate,
        periodEndDate: paychecks.periodEndDate,
        documentId: paychecks.documentId,
      })
      .from(paychecks);

    const exceptionRows = await ctx.db
      .select({
        employmentId: payPeriodExceptions.employmentId,
        periodKey: payPeriodExceptions.periodKey,
      })
      .from(payPeriodExceptions);

    const paychecksByEmployment: Record<
      string,
      Array<{
        id: string;
        periodStartDate: string;
        periodEndDate: string;
        hasStub: boolean;
      }>
    > = {};

    for (const row of paycheckRows) {
      const list = paychecksByEmployment[row.employmentId] ?? [];
      list.push({
        id: row.id,
        periodStartDate: row.periodStartDate,
        periodEndDate: row.periodEndDate,
        hasStub: row.documentId !== null,
      });
      paychecksByEmployment[row.employmentId] = list;
    }

    const missing = buildMissingPayStubItems(
      employmentRows,
      paychecksByEmployment,
      buildExceptionsByEmployment(exceptionRows),
    );

    return {
      missing,
      employmentCount: employmentRows.length,
    };
  }),
});
