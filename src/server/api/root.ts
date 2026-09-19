import { discussionsRouter } from "~/server/api/routers/discussions";
import { documentsRouter } from "~/server/api/routers/documents";
import { employersRouter } from "~/server/api/routers/employers";
import { employmentsRouter } from "~/server/api/routers/employments";
import { overviewRouter } from "~/server/api/routers/overview";
import { peopleRouter } from "~/server/api/routers/people";
import { setupRouter } from "~/server/api/routers/setup";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  discussions: discussionsRouter,
  documents: documentsRouter,
  employers: employersRouter,
  employments: employmentsRouter,
  overview: overviewRouter,
  people: peopleRouter,
  setup: setupRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
