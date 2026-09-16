import { scenarioInput } from "~/domain/tax-estimate";
import { z } from "zod";
import { buildTaxEstimate } from "../tax-estimate-values";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const taxEstimateRouter = createTRPCRouter({
  // The year id is part of the client cache key. Calculation still verifies the
  // server-side active year rather than trusting a client-selected year.
  get: publicProcedure.input(z.object({ taxYearId: z.number().int().positive() }).optional()).query(({ ctx, input }) => buildTaxEstimate(ctx.db, undefined, input?.taxYearId)),
  calculateScenario: publicProcedure.input(scenarioInput).mutation(async ({ ctx, input }) => {
    const baseline = await buildTaxEstimate(ctx.db);
    const result = await buildTaxEstimate(ctx.db, input);
    if (!baseline.supported || !result.supported) return result;
    const contributionCents = input.people.reduce((sum, item) => sum + item.rrspContributionCents + item.fhsaContributionCents, 0);
    const taxSavingsCents = result.projected.householdResultCents - baseline.projected.householdResultCents;
    const personSavings = result.projected.people.map((person) => ({
      personId: person.personId,
      personName: person.personName,
      taxSavingsCents: person.resultCents - (baseline.projected.people.find((baselinePerson) => baselinePerson.personId === person.personId)?.resultCents ?? 0),
    }));
    return { ...result, comparison: { baselineResultCents: baseline.projected.householdResultCents, scenarioResultCents: result.projected.householdResultCents, contributionCents, taxSavingsCents, afterTaxCostCents: contributionCents - taxSavingsCents, personSavings } };
  }),
});
