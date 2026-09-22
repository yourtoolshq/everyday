import { z } from "zod";

import { listActiveRecords } from "../record-values";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const recordRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ taxItemId: z.number().int().positive() }))
    .query(({ ctx, input }) => listActiveRecords(ctx.db, input.taxItemId)),
});
