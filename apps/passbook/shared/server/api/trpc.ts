import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { requireReady } from "@yourtoolshq/data";

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
export const publicProcedure = t.procedure.use(requireReady(dataPlatform));
