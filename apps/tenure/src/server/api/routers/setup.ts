import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { households, people } from "~/server/db/schema";

const setupInput = z.object({
  householdName: z.string().trim().min(1).max(120),
  people: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
});

export const setupRouter = createTRPCRouter({
  state: publicProcedure.query(async ({ ctx }) => ({
    initialized: Boolean(await ctx.db.query.households.findFirst()),
  })),
  initialize: publicProcedure
    .input(setupInput)
    .mutation(async ({ ctx, input }) => {
      if (await ctx.db.query.households.findFirst()) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Tenure has already been set up.",
        });
      }

      await ctx.db.transaction(async (tx) => {
        const [household] = await tx
          .insert(households)
          .values({ name: input.householdName })
          .returning({ id: households.id });
        if (!household) throw new Error("Household creation failed.");

        await tx.insert(people).values(
          input.people.map((displayName, sortOrder) => ({
            householdId: household.id,
            displayName,
            sortOrder,
          })),
        );
      });

      return { success: true };
    }),
});
