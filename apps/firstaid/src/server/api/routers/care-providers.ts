import { TRPCError } from "@trpc/server";
import { count, eq } from "drizzle-orm";
import { z } from "zod";

import { mapAppErrors } from "~/core/infrastructure/trpc-errors";
import {
  careOrganizationFieldsSchema,
  providerFieldsSchema,
} from "~/lib/visits";
import { createCareOrganization } from "~/modules/care-providers/application/create-care-organization";
import { getCareProvidersOverview } from "~/modules/care-providers/application/get-care-providers-overview";
import { createCareProvidersRepository } from "~/modules/care-providers/infrastructure/care-providers-repository";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { careOrganizations, providers, visits } from "~/server/db/schema";

const idInput = z.object({ id: z.string().uuid() });
const now = () => new Date().toISOString();

export const careProvidersRouter = createTRPCRouter({
  overview: publicProcedure.query(({ ctx }) =>
    mapAppErrors(() =>
      getCareProvidersOverview(createCareProvidersRepository(ctx.db)),
    ),
  ),

  createOrganization: publicProcedure
    .input(careOrganizationFieldsSchema)
    .mutation(({ ctx, input }) =>
      mapAppErrors(() =>
        createCareOrganization(createCareProvidersRepository(ctx.db), input),
      ),
    ),

  updateOrganization: publicProcedure
    .input(careOrganizationFieldsSchema.and(idInput))
    .mutation(async ({ ctx, input }) => {
      const { id, ...changes } = input;
      const [organization] = await ctx.db
        .update(careOrganizations)
        .set({ ...changes, updatedAt: now() })
        .where(eq(careOrganizations.id, id))
        .returning();
      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Care organization not found",
        });
      }
      return organization;
    }),

  deleteOrganization: publicProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const [providerCount, visitCount] = await Promise.all([
        ctx.db
          .select({ total: count() })
          .from(providers)
          .where(eq(providers.careOrganizationId, input.id)),
        ctx.db
          .select({ total: count() })
          .from(visits)
          .where(eq(visits.careOrganizationId, input.id)),
      ]);
      if (
        (providerCount[0]?.total ?? 0) > 0 ||
        (visitCount[0]?.total ?? 0) > 0
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Reassign this organization’s providers and visits before deleting it.",
        });
      }
      const [organization] = await ctx.db
        .delete(careOrganizations)
        .where(eq(careOrganizations.id, input.id))
        .returning();
      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Care organization not found",
        });
      }
      return organization;
    }),

  createProvider: publicProcedure
    .input(providerFieldsSchema)
    .mutation(async ({ ctx, input }) => {
      const [provider] = await ctx.db
        .insert(providers)
        .values(input)
        .returning();
      return provider!;
    }),

  updateProvider: publicProcedure
    .input(providerFieldsSchema.and(idInput))
    .mutation(async ({ ctx, input }) => {
      const { id, ...changes } = input;
      const [provider] = await ctx.db
        .update(providers)
        .set({ ...changes, updatedAt: now() })
        .where(eq(providers.id, id))
        .returning();
      if (!provider) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Provider not found",
        });
      }
      return provider;
    }),

  deleteProvider: publicProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const visitCount = await ctx.db
        .select({ total: count() })
        .from(visits)
        .where(eq(visits.providerId, input.id));
      if ((visitCount[0]?.total ?? 0) > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Reassign this provider’s visits before deleting them.",
        });
      }
      const [provider] = await ctx.db
        .delete(providers)
        .where(eq(providers.id, input.id))
        .returning();
      if (!provider) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Provider not found",
        });
      }
      return provider;
    }),
});
