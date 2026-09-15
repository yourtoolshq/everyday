import { systemRouter } from "~/server/api/routers/system";
import {
  createCallerFactory,
  createTRPCRouter,
} from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  system: systemRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);

