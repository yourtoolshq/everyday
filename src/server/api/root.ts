import { benefitsRouter } from "~/server/api/routers/benefits";
import { careProvidersRouter } from "~/server/api/routers/care-providers";
import { documentsRouter } from "~/server/api/routers/documents";
import { planningRouter } from "~/server/api/routers/planning";
import { systemRouter } from "~/server/api/routers/system";
import { visitsRouter } from "~/server/api/routers/visits";
import {
  createCallerFactory,
  createTRPCRouter,
} from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  benefits: benefitsRouter,
  careProviders: careProvidersRouter,
  documents: documentsRouter,
  planning: planningRouter,
  system: systemRouter,
  visits: visitsRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
