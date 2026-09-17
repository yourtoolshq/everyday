import { employmentRouter } from "~/server/api/routers/employment";
import { businessRouter } from "~/server/api/routers/business";
import { paychequeRouter } from "~/server/api/routers/paycheque";
import { recordRouter } from "~/server/api/routers/record";
import { settingsRouter } from "~/server/api/routers/settings";
import { setupRouter } from "~/server/api/routers/setup";
import { taxItemRouter } from "~/server/api/routers/tax-item";
import { filingRouter } from "~/server/api/routers/filing";
import { taxDocumentRouter } from "~/server/api/routers/tax-document";
import { taxYearRouter } from "~/server/api/routers/tax-year";
import { taxEstimateRouter } from "~/server/api/routers/tax-estimate";
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
  taxYear: taxYearRouter,
  taxEstimate: taxEstimateRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
