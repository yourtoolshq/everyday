import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { requireReady } from "@yourtoolshq/data";
import { createLogger } from "@yourtoolshq/server/log";

import { dataPlatform } from "~/server/data";
import { checkDatabaseConnection, db } from "~/server/db";

export const createTRPCContext = (opts: { headers: Headers }) => {
  return {
    db,
    files: dataPlatform.files,
    checkDatabaseConnection,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;
const logger = createLogger("roof");
export const publicProcedure = t.procedure
  .use(requireReady(dataPlatform))
  .use(async ({ next, path, type }) => {
    const start = Date.now();
    const result = await next();
    logger.info(path, {
      outcome: result.ok ? "success" : "failure",
      durationMs: Date.now() - start,
      type,
    });
    return result;
  });
