import { z } from "zod";

import { mapAppErrors } from "~/core/infrastructure/trpc-errors";
import { listGlobalHoldingsObservations } from "~/modules/investment-statements/infrastructure/holdings-query";
import {
  createInstrument,
  listInstruments,
  updateInstrument,
} from "~/modules/investments/application/instrument-service";
import { createInstrumentRepository } from "~/modules/investments/infrastructure/instrument-repository";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { identifierKinds, instrumentKinds } from "~/server/db/schema";

const identifierInput = z.object({
  kind: z.enum(identifierKinds),
  value: z.string().trim().min(1).max(80),
  namespace: z.string().trim().max(80).nullable(),
});

const instrumentInput = z.object({
  displayName: z.string().trim().min(1).max(160),
  kind: z.enum(instrumentKinds),
  series: z.string().trim().max(80).nullable(),
  notes: z.string().trim().max(2000).nullable(),
  identifiers: z.array(identifierInput),
});

export const investmentInstrumentsRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) =>
    mapAppErrors(() => listInstruments(createInstrumentRepository(ctx.db))),
  ),

  create: publicProcedure
    .input(instrumentInput)
    .mutation(({ ctx, input }) =>
      mapAppErrors(() =>
        createInstrument(createInstrumentRepository(ctx.db), input),
      ),
    ),

  update: publicProcedure
    .input(z.object({ id: z.string().uuid() }).and(instrumentInput))
    .mutation(({ ctx, input }) =>
      mapAppErrors(() => updateInstrument(ctx.db, input)),
    ),

  holdings: publicProcedure.query(({ ctx }) =>
    mapAppErrors(async () => {
      const instruments = await listInstruments(
        createInstrumentRepository(ctx.db),
      );
      const observations = await listGlobalHoldingsObservations(ctx.db);
      return {
        instruments,
        positions: observations.positions,
      };
    }),
  ),
});
