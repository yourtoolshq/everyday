import { z } from "zod";

import { mapAppErrors } from "~/core/infrastructure/trpc-errors";
import { listRecordsByTaxItem } from "~/modules/records/application/list-records-by-tax-item";
import { createRecordRepository } from "~/modules/records/infrastructure/record-repository";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const recordRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ taxItemId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      mapAppErrors(() =>
        listRecordsByTaxItem(createRecordRepository(ctx.db), input.taxItemId),
      ),
    ),
});
