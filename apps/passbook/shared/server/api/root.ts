import { accountEventsRouter } from "~/server/api/routers/account-events";
import { accountTermsRouter } from "~/server/api/routers/account-terms";
import { accountsRouter } from "~/server/api/routers/accounts";
import { documentsRouter } from "~/server/api/routers/documents";
import { institutionsRouter } from "~/server/api/routers/institutions";
import { overviewRouter } from "~/server/api/routers/overview";
import { peopleRouter } from "~/server/api/routers/people";
import { setupRouter } from "~/server/api/routers/setup";
import { statementPeriodExceptionsRouter } from "~/server/api/routers/statement-period-exceptions";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  accountEvents: accountEventsRouter,
  accountTerms: accountTermsRouter,
  accounts: accountsRouter,
  documents: documentsRouter,
  institutions: institutionsRouter,
  overview: overviewRouter,
  people: peopleRouter,
  setup: setupRouter,
  statementPeriodExceptions: statementPeriodExceptionsRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
