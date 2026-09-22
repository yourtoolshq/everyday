import { TRPCError } from "@trpc/server";
import { asc, count, eq } from "drizzle-orm";
import { z } from "zod";

import {
  careOrganizationFieldsSchema,
  providerFieldsSchema,
} from "~/lib/visits";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  careOrganizations,
  providers,
  visits,
} from "~/server/db/schema";

const idInput = z.object({ id: z.string().uuid() });
const now = () => new Date().toISOString();

export const careProvidersRouter = createTRPCRouter({
  overview: publicProcedure.query(async ({ ctx }) => {
    const [organizations, allProviders, organizationVisitCounts, providerVisitCounts] =
      await Promise.all([
        ctx.db.select().from(careOrganizations).orderBy(asc(careOrganizations.name)),
        ctx.db.select().from(providers).orderBy(asc(providers.name)),
        ctx.db
          .select({ id: visits.careOrganizationId, total: count() })
          .from(visits)
          .groupBy(visits.careOrganizationId),
        ctx.db
          .select({ id: visits.providerId, total: count() })
          .from(visits)
          .groupBy(visits.providerId),
      ]);

    const organizationVisits = new Map(
      organizationVisitCounts.map((row) => [row.id, row.total]),
    );
    const providerVisits = new Map(
      providerVisitCounts.map((row) => [row.id, row.total]),
    );

    return {
      organizations: organizations.map((organization) => ({
        ...organization,
        providerCount: allProviders.filter(
          (provider) => provider.careOrganizationId === organization.id,
        ).length,
        visitCount: organizationVisits.get(organization.id) ?? 0,
      })),
      providers: allProviders.map((provider) => ({
        ...provider,
        visitCount: providerVisits.get(provider.id) ?? 0,
      })),
    };
  }),

  createOrganization: publicProcedure
    .input(careOrganizationFieldsSchema)
    .mutation(async ({ ctx, input }) => {
      const [organization] = await ctx.db
        .insert(careOrganizations)
        .values(input)
        .returning();
      return organization!;
    }),

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
        throw new TRPCError({ code: "NOT_FOUND", message: "Care organization not found" });
      }
      return organization;
    }),

  deleteOrganization: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
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
    if ((providerCount[0]?.total ?? 0) > 0 || (visitCount[0]?.total ?? 0) > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Reassign this organization’s providers and visits before deleting it.",
      });
    }
    const [organization] = await ctx.db
      .delete(careOrganizations)
      .where(eq(careOrganizations.id, input.id))
      .returning();
    if (!organization) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Care organization not found" });
    }
    return organization;
  }),

  createProvider: publicProcedure
    .input(providerFieldsSchema)
    .mutation(async ({ ctx, input }) => {
      const [provider] = await ctx.db.insert(providers).values(input).returning();
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
        throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      }
      return provider;
    }),

  deleteProvider: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
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
      throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
    }
    return provider;
  }),
});
