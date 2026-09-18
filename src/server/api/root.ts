import { accountsRouter } from "~/server/api/routers/accounts";
import { documentsRouter } from "~/server/api/routers/documents";
import { institutionsRouter } from "~/server/api/routers/institutions";
import { overviewRouter } from "~/server/api/routers/overview";
import { peopleRouter } from "~/server/api/routers/people";
import { setupRouter } from "~/server/api/routers/setup";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  accounts: accountsRouter,
  documents: documentsRouter,
  institutions: institutionsRouter,
  overview: overviewRouter,
  people: peopleRouter,
  setup: setupRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
