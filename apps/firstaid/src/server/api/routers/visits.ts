import { TRPCError } from "@trpc/server";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  claimFieldsSchema,
  isBenefitEligible,
  validateClaimAllocation,
  validateVisitCostChange,
  visitFinancials,
} from "~/lib/benefits";
import { visitFieldsSchema, visitStatuses } from "~/lib/visits";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  benefits,
  careItems,
  careOrganizations,
  claims,
  documents,
  insurancePlans,
  people,
  providers,
  visits,
} from "~/server/db/schema";
import {
  discardStagedDocuments,
  restoreStagedDocuments,
  stageDocumentsForDeletion,
} from "~/server/documents/storage";

const idInput = z.object({ id: z.string().uuid() });
const now = () => new Date().toISOString();

async function validatedVisit(
  ctx: { db: typeof import("~/server/db").db },
  input: z.infer<typeof visitFieldsSchema>,
  visitId?: string,
) {
  if (input.careItemId) {
    const [item] = await ctx.db
      .select({ personId: careItems.personId })
      .from(careItems)
      .where(eq(careItems.id, input.careItemId));
    if (!item)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Care item not found",
      });
    if (item.personId !== input.personId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "The care item belongs to a different household member.",
      });
    }
  }

  let careOrganizationId = input.careOrganizationId;
  if (input.providerId) {
    const [provider] = await ctx.db
      .select()
      .from(providers)
      .where(eq(providers.id, input.providerId));
    if (!provider)
      throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
    careOrganizationId ??= provider.careOrganizationId;
  }
  if (careOrganizationId) {
    const [organization] = await ctx.db
      .select({ id: careOrganizations.id })
      .from(careOrganizations)
      .where(eq(careOrganizations.id, careOrganizationId));
    if (!organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Care organization not found",
      });
    }
  }

  if (visitId) {
    const existingClaims = await ctx.db
      .select()
      .from(claims)
      .where(eq(claims.visitId, visitId));
    const costError = validateVisitCostChange(input.costCents, existingClaims);
    if (costError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: costError });
    }
  }

  return { ...input, careOrganizationId };
}

async function validatedClaim(
  ctx: { db: typeof import("~/server/db").db },
  input: z.infer<typeof claimFieldsSchema>,
  claimId?: string,
) {
  const [visit] = await ctx.db
    .select()
    .from(visits)
    .where(eq(visits.id, input.visitId));
  if (!visit)
    throw new TRPCError({ code: "NOT_FOUND", message: "Visit not found" });
  if (visit.costCents === null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Record the visit cost before adding claims.",
    });
  }

  const [benefit] = await ctx.db
    .select({
      id: benefits.id,
      coverageScope: benefits.coverageScope,
      personId: benefits.personId,
      planYear: insurancePlans.year,
    })
    .from(benefits)
    .innerJoin(insurancePlans, eq(benefits.insurancePlanId, insurancePlans.id))
    .where(eq(benefits.id, input.benefitId));
  if (!benefit)
    throw new TRPCError({ code: "NOT_FOUND", message: "Benefit not found" });

  if (
    !isBenefitEligible(
      {
        coverageScope: benefit.coverageScope,
        personId: benefit.personId,
        planYear: benefit.planYear,
      },
      { personId: visit.personId, startsAt: visit.startsAt },
    )
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This benefit cannot be used for this visit.",
    });
  }

  const existingClaims = await ctx.db
    .select()
    .from(claims)
    .where(eq(claims.visitId, input.visitId));
  const claimIndex = claimId
    ? existingClaims.findIndex((claim) => claim.id === claimId)
    : undefined;
  const allocationError = validateClaimAllocation(
    visit.costCents,
    existingClaims,
    { status: input.status, amountCents: input.amountCents },
    claimIndex === -1 ? undefined : claimIndex,
  );
  if (allocationError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: allocationError });
  }

  return input;
}

export const visitsRouter = createTRPCRouter({
  overview: publicProcedure.query(async ({ ctx }) => {
    const [
      allVisits,
      allPeople,
      allCareItems,
      allProviders,
      allOrganizations,
      allDocuments,
    ] = await Promise.all([
      ctx.db.select().from(visits).orderBy(desc(visits.startsAt)),
      ctx.db.select().from(people).orderBy(asc(people.createdAt)),
      ctx.db.select().from(careItems).orderBy(asc(careItems.title)),
      ctx.db.select().from(providers).orderBy(asc(providers.name)),
      ctx.db
        .select()
        .from(careOrganizations)
        .orderBy(asc(careOrganizations.name)),
      ctx.db.select({ visitId: documents.visitId }).from(documents),
    ]);
    const documentCounts = new Map<string, number>();
    for (const document of allDocuments) {
      documentCounts.set(
        document.visitId,
        (documentCounts.get(document.visitId) ?? 0) + 1,
      );
    }
    return {
      visits: allVisits.map((visit) => ({
        ...visit,
        documentCount: documentCounts.get(visit.id) ?? 0,
      })),
      people: allPeople,
      careItems: allCareItems,
      providers: allProviders,
      organizations: allOrganizations,
    };
  }),

  detail: publicProcedure.input(idInput).query(async ({ ctx, input }) => {
    const [visit] = await ctx.db
      .select()
      .from(visits)
      .where(eq(visits.id, input.id));
    if (!visit) return null;

    const [
      person,
      careItem,
      provider,
      organization,
      visitDocuments,
      visitClaims,
    ] = await Promise.all([
      ctx.db
        .select()
        .from(people)
        .where(eq(people.id, visit.personId))
        .then((rows) => rows[0]!),
      visit.careItemId
        ? ctx.db
            .select()
            .from(careItems)
            .where(eq(careItems.id, visit.careItemId))
            .then((rows) => rows[0] ?? null)
        : null,
      visit.providerId
        ? ctx.db
            .select()
            .from(providers)
            .where(eq(providers.id, visit.providerId))
            .then((rows) => rows[0] ?? null)
        : null,
      visit.careOrganizationId
        ? ctx.db
            .select()
            .from(careOrganizations)
            .where(eq(careOrganizations.id, visit.careOrganizationId))
            .then((rows) => rows[0] ?? null)
        : null,
      ctx.db
        .select({
          id: documents.id,
          visitId: documents.visitId,
          claimId: documents.claimId,
          type: documents.type,
          title: documents.title,
          originalFilename: documents.originalFilename,
          mimeType: documents.mimeType,
          sizeBytes: documents.sizeBytes,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
        })
        .from(documents)
        .where(eq(documents.visitId, visit.id))
        .orderBy(desc(documents.createdAt)),
      ctx.db
        .select({
          claim: claims,
          benefitName: benefits.name,
        })
        .from(claims)
        .innerJoin(benefits, eq(claims.benefitId, benefits.id))
        .where(eq(claims.visitId, visit.id))
        .orderBy(desc(claims.createdAt)),
    ]);

    const claimRows = visitClaims.map((row) => ({
      ...row.claim,
      benefitName: row.benefitName,
    }));

    return {
      visit: { ...visit, documentCount: visitDocuments.length },
      person,
      careItem,
      provider,
      organization,
      documents: visitDocuments,
      claims: claimRows,
      financials: visitFinancials(visit.costCents, claimRows),
    };
  }),

  eligibleBenefits: publicProcedure
    .input(idInput)
    .query(async ({ ctx, input }) => {
      const [visit] = await ctx.db
        .select()
        .from(visits)
        .where(eq(visits.id, input.id));
      if (!visit) return [];

      const allBenefits = await ctx.db
        .select({
          id: benefits.id,
          name: benefits.name,
          coverageScope: benefits.coverageScope,
          personId: benefits.personId,
          annualLimitCents: benefits.annualLimitCents,
          openingUsedCents: benefits.openingUsedCents,
          planYear: insurancePlans.year,
        })
        .from(benefits)
        .innerJoin(
          insurancePlans,
          eq(benefits.insurancePlanId, insurancePlans.id),
        );

      const allClaims = await ctx.db.select().from(claims);
      const paidByBenefit = new Map<string, number[]>();
      for (const claim of allClaims) {
        if (claim.status !== "paid") continue;
        const amounts = paidByBenefit.get(claim.benefitId) ?? [];
        amounts.push(claim.amountCents);
        paidByBenefit.set(claim.benefitId, amounts);
      }

      return allBenefits
        .filter((benefit) =>
          isBenefitEligible(
            {
              coverageScope: benefit.coverageScope,
              personId: benefit.personId,
              planYear: benefit.planYear,
            },
            { personId: visit.personId, startsAt: visit.startsAt },
          ),
        )
        .map((benefit) => {
          const paidAmounts = paidByBenefit.get(benefit.id) ?? [];
          const usedCents =
            benefit.openingUsedCents +
            paidAmounts.reduce((sum, amount) => sum + amount, 0);
          const remainingCents = Math.max(
            benefit.annualLimitCents - usedCents,
            0,
          );
          return {
            id: benefit.id,
            name: benefit.name,
            coverageScope: benefit.coverageScope,
            remainingCents,
          };
        });
    }),

  create: publicProcedure
    .input(visitFieldsSchema)
    .mutation(async ({ ctx, input }) => {
      const values = await validatedVisit(ctx, input);
      const [visit] = await ctx.db.insert(visits).values(values).returning();
      return visit!;
    }),

  update: publicProcedure
    .input(visitFieldsSchema.and(idInput))
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const values = await validatedVisit(ctx, fields, id);
      const [visit] = await ctx.db
        .update(visits)
        .set({ ...values, updatedAt: now() })
        .where(eq(visits.id, id))
        .returning();
      if (!visit)
        throw new TRPCError({ code: "NOT_FOUND", message: "Visit not found" });
      return visit;
    }),

  setStatus: publicProcedure
    .input(z.object({ id: z.string().uuid(), status: z.enum(visitStatuses) }))
    .mutation(async ({ ctx, input }) => {
      const [visit] = await ctx.db
        .update(visits)
        .set({ status: input.status, updatedAt: now() })
        .where(eq(visits.id, input.id))
        .returning();
      if (!visit)
        throw new TRPCError({ code: "NOT_FOUND", message: "Visit not found" });
      return visit;
    }),

  delete: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [visit, visitDocuments] = await Promise.all([
      ctx.db
        .select()
        .from(visits)
        .where(eq(visits.id, input.id))
        .then((rows) => rows[0]),
      ctx.db
        .select({ storageKey: documents.storageKey })
        .from(documents)
        .where(eq(documents.visitId, input.id)),
    ]);
    if (!visit)
      throw new TRPCError({ code: "NOT_FOUND", message: "Visit not found" });

    const staged = await stageDocumentsForDeletion(
      visitDocuments.map((document) => document.storageKey),
    );
    try {
      await ctx.db.delete(visits).where(eq(visits.id, input.id));
    } catch (error) {
      await restoreStagedDocuments(staged);
      throw error;
    }
    await discardStagedDocuments(staged);
    return visit;
  }),

  createClaim: publicProcedure
    .input(claimFieldsSchema)
    .mutation(async ({ ctx, input }) => {
      const values = await validatedClaim(ctx, input);
      const [claim] = await ctx.db.insert(claims).values(values).returning();
      return claim!;
    }),

  updateClaim: publicProcedure
    .input(claimFieldsSchema.and(idInput))
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const values = await validatedClaim(ctx, fields, id);
      const [claim] = await ctx.db
        .update(claims)
        .set({ ...values, updatedAt: now() })
        .where(eq(claims.id, id))
        .returning();
      if (!claim)
        throw new TRPCError({ code: "NOT_FOUND", message: "Claim not found" });
      return claim;
    }),

  deleteClaim: publicProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const [claim] = await ctx.db
        .delete(claims)
        .where(eq(claims.id, input.id))
        .returning();
      if (!claim)
        throw new TRPCError({ code: "NOT_FOUND", message: "Claim not found" });
      return claim;
    }),
});
