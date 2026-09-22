import { count } from "drizzle-orm";

import { householdPaySummaryProcedure } from "~/server/api/routers/employment-records";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { employers, employments, people } from "~/server/db/schema";

export const overviewRouter = createTRPCRouter({
  paySummary: householdPaySummaryProcedure,

  summary: publicProcedure.query(async ({ ctx }) => {
    const [household] = await ctx.db.query.households.findMany({ limit: 1 });
    const [[peopleCount], [employerCount], [employmentCount]] =
      await Promise.all([
        ctx.db.select({ value: count() }).from(people),
        ctx.db.select({ value: count() }).from(employers),
        ctx.db.select({ value: count() }).from(employments),
      ]);

    return {
      householdName: household?.name ?? null,
      peopleCount: peopleCount?.value ?? 0,
      employerCount: employerCount?.value ?? 0,
      employmentCount: employmentCount?.value ?? 0,
    };
  }),
});
