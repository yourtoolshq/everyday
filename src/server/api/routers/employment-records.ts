import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  buildMissingEmploymentRecordItems,
  buildRecordExceptionsByEmployment,
  deriveEmploymentRecordCompleteness,
  parseRequirementKey,
} from "~/lib/employment-record-completeness";
import { buildHouseholdPaySummary, sumPaychecks } from "~/lib/employment-pay-summaries";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  compensationChanges,
  documents,
  employers,
  employmentRecordExceptions,
  employments,
  paychecks,
  people,
} from "~/server/db/schema";

const employmentIdInput = z.object({ employmentId: z.string().uuid() });

const requirementKeyInput = z.object({
  employmentId: z.string().uuid(),
  requirementKey: z.string().trim().min(1).max(80),
});

async function loadEmploymentRecordData(
  ctx: { db: typeof import("~/server/db").db },
  employmentId: string,
) {
  const [employment] = await ctx.db
    .select({ id: employments.id })
    .from(employments)
    .where(eq(employments.id, employmentId));

  if (!employment) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Employment not found." });
  }

  const [documentRows, compensationRows, exceptionRows] = await Promise.all([
    ctx.db
      .select({
        id: documents.id,
        type: documents.type,
      })
      .from(documents)
      .where(eq(documents.employmentId, employmentId)),
    ctx.db
      .select({
        id: compensationChanges.id,
        employmentId: compensationChanges.employmentId,
        type: compensationChanges.type,
        currency: compensationChanges.currency,
        effectiveDate: compensationChanges.effectiveDate,
        amountCents: compensationChanges.amountCents,
        commissionBasisPoints: compensationChanges.commissionBasisPoints,
        notes: compensationChanges.notes,
        documentId: compensationChanges.documentId,
        discussionId: compensationChanges.discussionId,
      })
      .from(compensationChanges)
      .where(eq(compensationChanges.employmentId, employmentId))
      .orderBy(asc(compensationChanges.effectiveDate), asc(compensationChanges.createdAt)),
    ctx.db
      .select({
        employmentId: employmentRecordExceptions.employmentId,
        requirementKey: employmentRecordExceptions.requirementKey,
      })
      .from(employmentRecordExceptions)
      .where(eq(employmentRecordExceptions.employmentId, employmentId)),
  ]);

  const documentsById = new Map(documentRows.map((document) => [document.id, document]));
  const exceptions = buildRecordExceptionsByEmployment(exceptionRows)[employmentId] ?? {};

  return deriveEmploymentRecordCompleteness(compensationRows, {
    documents: documentRows,
    documentsById,
    exceptions,
  });
}

export const employmentRecordsRouter = createTRPCRouter({
  completenessByEmployment: publicProcedure.input(employmentIdInput).query(async ({ ctx, input }) => {
    return loadEmploymentRecordData(ctx, input.employmentId);
  }),

  paySummaryByEmployment: publicProcedure.input(employmentIdInput).query(async ({ ctx, input }) => {
    const [employment] = await ctx.db
      .select({ id: employments.id })
      .from(employments)
      .where(eq(employments.id, input.employmentId));

    if (!employment) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Employment not found." });
    }

    const paycheckRows = await ctx.db
      .select({
        payDate: paychecks.payDate,
        grossPayCents: paychecks.grossPayCents,
        netPayCents: paychecks.netPayCents,
      })
      .from(paychecks)
      .where(eq(paychecks.employmentId, input.employmentId));

    const household = buildHouseholdPaySummary(paycheckRows);
    return {
      year: household.year,
      lifetime: household.lifetime,
      thisYear: household.thisYear,
    };
  }),

  markNotApplicable: publicProcedure.input(requirementKeyInput).mutation(async ({ ctx, input }) => {
    if (!parseRequirementKey(input.requirementKey)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Unknown employment record requirement.",
      });
    }

    const [employment] = await ctx.db
      .select({ id: employments.id })
      .from(employments)
      .where(eq(employments.id, input.employmentId));

    if (!employment) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Employment not found." });
    }

    const parsed = parseRequirementKey(input.requirementKey);
    if (parsed?.kind === "compensation_change") {
      const [change] = await ctx.db
        .select({ id: compensationChanges.id })
        .from(compensationChanges)
        .where(
          and(
            eq(compensationChanges.id, parsed.changeId),
            eq(compensationChanges.employmentId, input.employmentId),
          ),
        );
      if (!change) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Compensation change not found for this employment.",
        });
      }
    }

    await ctx.db
      .insert(employmentRecordExceptions)
      .values({
        employmentId: input.employmentId,
        requirementKey: input.requirementKey,
      })
      .onConflictDoNothing();

    return input;
  }),

  undoNotApplicable: publicProcedure.input(requirementKeyInput).mutation(async ({ ctx, input }) => {
    await ctx.db
      .delete(employmentRecordExceptions)
      .where(
        and(
          eq(employmentRecordExceptions.employmentId, input.employmentId),
          eq(employmentRecordExceptions.requirementKey, input.requirementKey),
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
      })
      .from(employments)
      .innerJoin(employers, eq(employments.employerId, employers.id))
      .innerJoin(people, eq(employments.personId, people.id))
      .orderBy(asc(employers.name), asc(people.displayName));

    const [documentRows, compensationRows, exceptionRows] = await Promise.all([
      ctx.db.select({
        id: documents.id,
        employmentId: documents.employmentId,
        type: documents.type,
      }).from(documents),
      ctx.db.select({
        id: compensationChanges.id,
        employmentId: compensationChanges.employmentId,
        type: compensationChanges.type,
        currency: compensationChanges.currency,
        effectiveDate: compensationChanges.effectiveDate,
        amountCents: compensationChanges.amountCents,
        commissionBasisPoints: compensationChanges.commissionBasisPoints,
        notes: compensationChanges.notes,
        documentId: compensationChanges.documentId,
        discussionId: compensationChanges.discussionId,
      }).from(compensationChanges),
      ctx.db.select({
        employmentId: employmentRecordExceptions.employmentId,
        requirementKey: employmentRecordExceptions.requirementKey,
      }).from(employmentRecordExceptions),
    ]);

    const dataByEmployment: Record<
      string,
      {
        documents: Array<{ type: (typeof documentRows)[number]["type"] }>;
        documentsById: Map<
          string,
          { id: string; type: (typeof documentRows)[number]["type"] }
        >;
        compensationChanges: (typeof compensationRows)[number][];
      }
    > = {};

    for (const employment of employmentRows) {
      dataByEmployment[employment.id] = {
        documents: [],
        documentsById: new Map(),
        compensationChanges: [],
      };
    }

    for (const document of documentRows) {
      const bucket = dataByEmployment[document.employmentId];
      if (!bucket) continue;
      bucket.documents.push({ type: document.type });
      bucket.documentsById.set(document.id, document);
    }

    for (const change of compensationRows) {
      const bucket = dataByEmployment[change.employmentId];
      if (!bucket) continue;
      bucket.compensationChanges.push(change);
    }

    const missing = buildMissingEmploymentRecordItems(
      employmentRows,
      dataByEmployment,
      buildRecordExceptionsByEmployment(exceptionRows),
    );

    return {
      missing,
      employmentCount: employmentRows.length,
    };
  }),
});

export const householdPaySummaryProcedure = publicProcedure.query(async ({ ctx }) => {
  const paycheckRows = await ctx.db.select({
    payDate: paychecks.payDate,
    grossPayCents: paychecks.grossPayCents,
    netPayCents: paychecks.netPayCents,
  }).from(paychecks);

  const summary = buildHouseholdPaySummary(paycheckRows);

  const employmentSummaries = await ctx.db
    .select({
      employmentId: paychecks.employmentId,
      employerName: employers.name,
      personName: people.displayName,
      payDate: paychecks.payDate,
      grossPayCents: paychecks.grossPayCents,
      netPayCents: paychecks.netPayCents,
    })
    .from(paychecks)
    .innerJoin(employments, eq(paychecks.employmentId, employments.id))
    .innerJoin(employers, eq(employments.employerId, employers.id))
    .innerJoin(people, eq(employments.personId, people.id));

  const byEmployment = new Map<
    string,
    {
      employmentId: string;
      employerName: string;
      personName: string;
      paychecks: Array<{ payDate: string; grossPayCents: number; netPayCents: number }>;
    }
  >();

  for (const row of employmentSummaries) {
    const existing = byEmployment.get(row.employmentId) ?? {
      employmentId: row.employmentId,
      employerName: row.employerName,
      personName: row.personName,
      paychecks: [],
    };
    existing.paychecks.push({
      payDate: row.payDate,
      grossPayCents: row.grossPayCents,
      netPayCents: row.netPayCents,
    });
    byEmployment.set(row.employmentId, existing);
  }

  const employmentsWithPay = [...byEmployment.values()]
    .map((employment) => ({
      employmentId: employment.employmentId,
      employerName: employment.employerName,
      personName: employment.personName,
      lifetime: sumPaychecks(employment.paychecks),
      thisYear: sumPaychecks(employment.paychecks, summary.year),
    }))
    .sort((left, right) => left.employerName.localeCompare(right.employerName));

  return {
    year: summary.year,
    lifetime: summary.lifetime,
    thisYear: summary.thisYear,
    employments: employmentsWithPay,
  };
});
