import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { mapAppErrors } from "~/core/infrastructure/trpc-errors";
import { createInstitution } from "~/modules/institutions/application/create-institution";
import { listInstitutions } from "~/modules/institutions/application/list-institutions";
import { createInstitutionRepository } from "~/modules/institutions/infrastructure/institution-repository";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { institutions } from "~/server/db/schema";

const institutionInput = z.object({
  name: z.string().trim().min(1).max(160),
  website: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const idInput = z.object({ id: z.string().uuid() });
const now = () => new Date().toISOString();

export const institutionsRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) =>
    mapAppErrors(() =>
      listInstitutions(createInstitutionRepository(ctx.db)),
    ),
  ),

  create: publicProcedure
    .input(institutionInput)
    .mutation(({ ctx, input }) =>
      mapAppErrors(() =>
        createInstitution(createInstitutionRepository(ctx.db), input),
      ),
    ),

  update: publicProcedure
    .input(idInput.and(institutionInput))
    .mutation(async ({ ctx, input }) => {
      const [institution] = await ctx.db
        .update(institutions)
        .set({
          name: input.name,
          website: input.website ?? null,
          notes: input.notes ?? null,
          updatedAt: now(),
        })
        .where(eq(institutions.id, input.id))
        .returning();
      if (!institution) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Institution not found.",
        });
      }
      return institution;
    }),

  delete: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [institution] = await ctx.db
      .delete(institutions)
      .where(eq(institutions.id, input.id))
      .returning({ id: institutions.id });
    if (!institution) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Institution not found.",
      });
    }
    return institution;
  }),
});
