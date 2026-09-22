import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const systemRouter = createTRPCRouter({
  status: publicProcedure.query(async ({ ctx }) => {
    await ctx.checkDatabaseConnection();
    return { status: "ok" as const };
  }),
});

