import { TRPCError } from "@trpc/server";
import { asc, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  benefitFieldsSchema,
  benefitPendingCents,
  benefitRemainingCents,
  benefitUsedCents,
  insurancePlanFieldsSchema,
  visitCalendarYear,
} from "~/lib/benefits";
import { planYearSchema } from "~/lib/care-planning";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  benefits,
  claims,
  insurancePlans,
  people,
  visits,
} from "~/server/db/schema";

const idInput = z.object({ id: z.string().uuid() });
const now = () => new Date().toISOString();

async function validatedBenefit(
  ctx: { db: typeof import("~/server/db").db },
  input: z.infer<typeof benefitFieldsSchema>,
) {
  const [plan] = await ctx.db
    .select({ id: insurancePlans.id })
    .from(insurancePlans)
    .where(eq(insurancePlans.id, input.insurancePlanId));
  if (!plan) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Insurance plan not found" });
  }

  if (input.personId) {
    const [person] = await ctx.db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.id, input.personId));
    if (!person) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Household member not found" });
    }
  }

  return input;
}

export const benefitsRouter = createTRPCRouter({
  overview: publicProcedure
    .input(z.object({ year: planYearSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const selectedYear = input?.year ?? new Date().getFullYear();
      const [allPeople, allPlans, allBenefits, allClaims, allVisits] = await Promise.all([
        ctx.db.select().from(people).orderBy(asc(people.createdAt)),
        ctx.db.select().from(insurancePlans).orderBy(desc(insurancePlans.year)),
        ctx.db.select().from(benefits).orderBy(asc(benefits.name)),
        ctx.db.select().from(claims),
        ctx.db.select({ id: visits.id, startsAt: visits.startsAt }).from(visits),
      ]);

      const visitYearById = new Map(
        allVisits.map((visit) => [visit.id, visitCalendarYear(visit.startsAt)]),
      );
      const plansForYear = allPlans.filter((plan) => plan.year === selectedYear);
      const planIds = new Set(plansForYear.map((plan) => plan.id));

      const benefitsForYear = allBenefits.filter((benefit) => planIds.has(benefit.insurancePlanId));
      const benefitIds = new Set(benefitsForYear.map((benefit) => benefit.id));

      const claimsForBenefits = allClaims.filter((claim) => benefitIds.has(claim.benefitId));

      const paidAmountsByBenefit = new Map<string, number[]>();
      const pendingByBenefit = new Map<string, number>();

      for (const claim of claimsForBenefits) {
        const visitYear = visitYearById.get(claim.visitId);
        if (visitYear !== selectedYear) continue;

        if (claim.status === "paid") {
          const amounts = paidAmountsByBenefit.get(claim.benefitId) ?? [];
          amounts.push(claim.amountCents);
          paidAmountsByBenefit.set(claim.benefitId, amounts);
        }
      }

      for (const benefit of benefitsForYear) {
        const benefitClaims = claimsForBenefits.filter((claim) => {
          if (claim.benefitId !== benefit.id) return false;
          const visitYear = visitYearById.get(claim.visitId);
          return visitYear === selectedYear;
        });
        pendingByBenefit.set(benefit.id, benefitPendingCents(benefitClaims));
      }

      const years = Array.from(new Set(allPlans.map((plan) => plan.year))).sort((a, b) => b - a);

      return {
        people: allPeople,
        years,
        selectedYear,
        plans: plansForYear.map((plan) => ({
          ...plan,
          benefits: benefitsForYear
            .filter((benefit) => benefit.insurancePlanId === plan.id)
            .map((benefit) => {
              const paidAmounts = paidAmountsByBenefit.get(benefit.id) ?? [];
              const usedCents = benefitUsedCents(benefit.openingUsedCents, paidAmounts);
              const { remainingCents, overLimitCents } = benefitRemainingCents(
                benefit.annualLimitCents,
                usedCents,
              );
              return {
                ...benefit,
                usedCents,
                pendingCents: pendingByBenefit.get(benefit.id) ?? 0,
                remainingCents,
                overLimitCents,
                resetDate: `${plan.year + 1}-01-01`,
              };
            }),
        })),
      };
    }),

  createPlan: publicProcedure.input(insurancePlanFieldsSchema).mutation(async ({ ctx, input }) => {
    const [plan] = await ctx.db.insert(insurancePlans).values(input).returning();
    return plan!;
  }),

  updatePlan: publicProcedure
    .input(insurancePlanFieldsSchema.and(idInput))
    .mutation(async ({ ctx, input }) => {
      const { id, ...changes } = input;
      const [plan] = await ctx.db
        .update(insurancePlans)
        .set({ ...changes, updatedAt: now() })
        .where(eq(insurancePlans.id, id))
        .returning();
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Insurance plan not found" });
      return plan;
    }),

  deletePlan: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const planBenefits = await ctx.db
      .select({ id: benefits.id })
      .from(benefits)
      .where(eq(benefits.insurancePlanId, input.id));
    if (planBenefits.length > 0) {
      const benefitIds = planBenefits.map((benefit) => benefit.id);
      const [claimCount] = await ctx.db
        .select({ total: count() })
        .from(claims)
        .where(inArray(claims.benefitId, benefitIds));
      if ((claimCount?.total ?? 0) > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This insurance plan has claims on its benefits and cannot be deleted.",
        });
      }
    }

    const [plan] = await ctx.db
      .delete(insurancePlans)
      .where(eq(insurancePlans.id, input.id))
      .returning();
    if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Insurance plan not found" });
    return plan;
  }),

  createBenefit: publicProcedure.input(benefitFieldsSchema).mutation(async ({ ctx, input }) => {
    const values = await validatedBenefit(ctx, input);
    const [benefit] = await ctx.db.insert(benefits).values(values).returning();
    return benefit!;
  }),

  updateBenefit: publicProcedure
    .input(benefitFieldsSchema.and(idInput))
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const values = await validatedBenefit(ctx, fields);
      const [benefit] = await ctx.db
        .update(benefits)
        .set({ ...values, updatedAt: now() })
        .where(eq(benefits.id, id))
        .returning();
      if (!benefit) throw new TRPCError({ code: "NOT_FOUND", message: "Benefit not found" });
      return benefit;
    }),

  deleteBenefit: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [claimCount] = await ctx.db
      .select({ total: count() })
      .from(claims)
      .where(eq(claims.benefitId, input.id));
    if ((claimCount?.total ?? 0) > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This benefit has claims and cannot be deleted.",
      });
    }

    const [benefit] = await ctx.db.delete(benefits).where(eq(benefits.id, input.id)).returning();
    if (!benefit) throw new TRPCError({ code: "NOT_FOUND", message: "Benefit not found" });
    return benefit;
  }),

  benefitDetail: publicProcedure.input(idInput).query(async ({ ctx, input }) => {
    const [benefit] = await ctx.db.select().from(benefits).where(eq(benefits.id, input.id));
    if (!benefit) return null;

    const [plan, person, benefitClaims] = await Promise.all([
      ctx.db
        .select()
        .from(insurancePlans)
        .where(eq(insurancePlans.id, benefit.insurancePlanId))
        .then((rows) => rows[0] ?? null),
      benefit.personId
        ? ctx.db
            .select()
            .from(people)
            .where(eq(people.id, benefit.personId))
            .then((rows) => rows[0] ?? null)
        : null,
      ctx.db
        .select({
          claim: claims,
          visitTitle: visits.title,
          visitStartsAt: visits.startsAt,
          visitPersonId: visits.personId,
        })
        .from(claims)
        .innerJoin(visits, eq(claims.visitId, visits.id))
        .where(eq(claims.benefitId, input.id))
        .orderBy(desc(visits.startsAt)),
    ]);

    if (!plan) return null;

    const paidAmounts = benefitClaims
      .filter((row) => row.claim.status === "paid")
      .map((row) => row.claim.amountCents);
    const usedCents = benefitUsedCents(benefit.openingUsedCents, paidAmounts);
    const { remainingCents, overLimitCents } = benefitRemainingCents(
      benefit.annualLimitCents,
      usedCents,
    );

    return {
      benefit,
      plan,
      person,
      usedCents,
      pendingCents: benefitPendingCents(benefitClaims.map((row) => row.claim)),
      remainingCents,
      overLimitCents,
      resetDate: `${plan.year + 1}-01-01`,
      claims: benefitClaims.map((row) => ({
        ...row.claim,
        visitTitle: row.visitTitle,
        visitStartsAt: row.visitStartsAt,
        visitPersonId: row.visitPersonId,
      })),
    };
  }),
});
