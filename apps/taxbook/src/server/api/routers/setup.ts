import { TRPCError } from "@trpc/server";

import { setupInput } from "~/domain/tax-item";
import { households, people, taxYears } from "~/server/db/schema";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const setupRouter = createTRPCRouter({
  state: publicProcedure.query(async ({ ctx }) => ({
    initialized: Boolean(await ctx.db.query.households.findFirst()),
  })),
  initialize: publicProcedure.input(setupInput).mutation(async ({ ctx, input }) => {
    if (await ctx.db.query.households.findFirst()) {
      throw new TRPCError({ code: "CONFLICT", message: "This Tax Book has already been set up." });
    }
    await ctx.db.transaction(async (tx) => {
      const [household] = await tx.insert(households).values({ name: input.householdName }).returning({ id: households.id });
      if (!household) throw new Error("Household creation failed.");
      await tx.insert(people).values(input.people.map((name, sortOrder) => ({ householdId: household.id, name, sortOrder })));
      await tx.insert(taxYears).values({ householdId: household.id, year: input.year, isActive: true });
    });
    return { success: true };
  }),
});
