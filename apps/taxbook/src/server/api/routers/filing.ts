import { z } from "zod";

import { listFilingTimeline, listSnapshotCandidates } from "../filing-values";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const filingRouter = createTRPCRouter({
  timeline: publicProcedure
    .input(z.object({ taxYearId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => listFilingTimeline(ctx.db, input.taxYearId)),
  snapshotCandidates: publicProcedure
    .input(
      z.object({
        taxYearId: z.number().int().positive(),
        personId: z.number().int().positive(),
      }),
    )
    .query(({ ctx, input }) =>
      listSnapshotCandidates(ctx.db, input.taxYearId, input.personId),
    ),
});
