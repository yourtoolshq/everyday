import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { employers } from "~/server/db/schema";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const employerInput = z.object({
  name: z.string().trim().min(1).max(160),
  website: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const idInput = z.object({ id: z.string().uuid() });
const now = () => new Date().toISOString();

export const employersRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.employers.findMany({
      orderBy: [asc(employers.name)],
    });
  }),

  create: publicProcedure.input(employerInput).mutation(async ({ ctx, input }) => {
    const [employer] = await ctx.db
      .insert(employers)
      .values({
        name: input.name,
        website: input.website ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    return employer;
  }),

  update: publicProcedure
    .input(idInput.and(employerInput))
    .mutation(async ({ ctx, input }) => {
      const [employer] = await ctx.db
        .update(employers)
        .set({
          name: input.name,
          website: input.website ?? null,
          notes: input.notes ?? null,
          updatedAt: now(),
        })
        .where(eq(employers.id, input.id))
        .returning();
      if (!employer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employer not found." });
      }
      return employer;
    }),

  delete: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [employer] = await ctx.db
      .delete(employers)
      .where(eq(employers.id, input.id))
      .returning({ id: employers.id });
    if (!employer) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Employer not found." });
    }
    return employer;
  }),
});
