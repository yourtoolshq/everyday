import { compensationChangesRouter } from "~/server/api/routers/compensation-changes";
import { discussionsRouter } from "~/server/api/routers/discussions";
import { documentsRouter } from "~/server/api/routers/documents";
import { employersRouter } from "~/server/api/routers/employers";
import { employmentRecordsRouter } from "~/server/api/routers/employment-records";
import { employmentsRouter } from "~/server/api/routers/employments";
import { overviewRouter } from "~/server/api/routers/overview";
import { paychecksRouter } from "~/server/api/routers/paychecks";
import { peopleRouter } from "~/server/api/routers/people";
import { setupRouter } from "~/server/api/routers/setup";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  compensationChanges: compensationChangesRouter,
  discussions: discussionsRouter,
  documents: documentsRouter,
  employers: employersRouter,
  employmentRecords: employmentRecordsRouter,
  employments: employmentsRouter,
  overview: overviewRouter,
  paychecks: paychecksRouter,
  people: peopleRouter,
  setup: setupRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
