import { businessRouter } from "~/server/api/routers/business";
import { craReferenceRouter } from "~/server/api/routers/cra-reference";
import { employmentRouter } from "~/server/api/routers/employment";
import { filingRouter } from "~/server/api/routers/filing";
import { paychequeRouter } from "~/server/api/routers/paycheque";
import { recordRouter } from "~/server/api/routers/record";
import { settingsRouter } from "~/server/api/routers/settings";
import { setupRouter } from "~/server/api/routers/setup";
import { taxDocumentRouter } from "~/server/api/routers/tax-document";
import { taxEstimateRouter } from "~/server/api/routers/tax-estimate";
import { taxItemRouter } from "~/server/api/routers/tax-item";
import { taxYearRouter } from "~/server/api/routers/tax-year";
import { tenureSyncRouter } from "~/server/api/routers/tenure-sync";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  business: businessRouter,
  employment: employmentRouter,
  paycheque: paychequeRouter,
  record: recordRouter,
  settings: settingsRouter,
  setup: setupRouter,
  taxItem: taxItemRouter,
  taxDocument: taxDocumentRouter,
  filing: filingRouter,
  craReference: craReferenceRouter,
  taxYear: taxYearRouter,
  taxEstimate: taxEstimateRouter,
  tenureSync: tenureSyncRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
