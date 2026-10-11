import { propertiesRouter } from "~/server/api/routers/properties";
import { systemRouter } from "~/server/api/routers/system";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  system: systemRouter,
  properties: propertiesRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
