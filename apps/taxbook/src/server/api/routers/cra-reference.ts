import { z } from "zod";

import { listCraReferenceDocuments } from "../cra-reference-values";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const craReferenceRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ taxYearId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      listCraReferenceDocuments(ctx.db, input.taxYearId),
    ),
});
