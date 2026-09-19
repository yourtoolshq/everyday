import { count } from "drizzle-orm";

import { employers, employments, people } from "~/server/db/schema";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const overviewRouter = createTRPCRouter({
  summary: publicProcedure.query(async ({ ctx }) => {
    const [household] = await ctx.db.query.households.findMany({ limit: 1 });
    const [[peopleCount], [employerCount], [employmentCount]] = await Promise.all([
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
