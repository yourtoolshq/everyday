import { z } from "zod";

import {
  getTaxDocumentOverview,
  listActiveTaxDocuments,
} from "../tax-document-values";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const taxDocumentRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ taxItemId: z.number().int().positive() }).optional())
    .query(({ ctx, input }) =>
      listActiveTaxDocuments(ctx.db, input?.taxItemId),
    ),
  overview: publicProcedure.query(({ ctx }) => getTaxDocumentOverview(ctx.db)),
});
