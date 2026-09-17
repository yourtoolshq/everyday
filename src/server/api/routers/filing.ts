import { z } from "zod";

import { listFilingTimeline } from "../filing-values";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const filingRouter = createTRPCRouter({
  timeline: publicProcedure
    .input(z.object({ taxYearId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => listFilingTimeline(ctx.db, input.taxYearId)),
});
