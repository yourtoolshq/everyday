import { TRPCError } from "@trpc/server";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { visitFieldsSchema, visitStatuses } from "~/lib/visits";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  careItems,
  careOrganizations,
  people,
  providers,
  visits,
} from "~/server/db/schema";

const idInput = z.object({ id: z.string().uuid() });
const now = () => new Date().toISOString();

async function validatedVisit(
  ctx: { db: typeof import("~/server/db").db },
  input: z.infer<typeof visitFieldsSchema>,
) {
  if (input.careItemId) {
    const [item] = await ctx.db
      .select({ personId: careItems.personId })
      .from(careItems)
      .where(eq(careItems.id, input.careItemId));
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Care item not found" });
    if (item.personId !== input.personId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "The care item belongs to a different household member.",
      });
    }
  }

  let careOrganizationId = input.careOrganizationId;
  if (input.providerId) {
    const [provider] = await ctx.db
      .select()
      .from(providers)
      .where(eq(providers.id, input.providerId));
    if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
    careOrganizationId ??= provider.careOrganizationId;
  }
  if (careOrganizationId) {
    const [organization] = await ctx.db
      .select({ id: careOrganizations.id })
      .from(careOrganizations)
      .where(eq(careOrganizations.id, careOrganizationId));
    if (!organization) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Care organization not found" });
    }
  }

  return { ...input, careOrganizationId };
}

export const visitsRouter = createTRPCRouter({
  overview: publicProcedure.query(async ({ ctx }) => {
    const [allVisits, allPeople, allCareItems, allProviders, allOrganizations] =
      await Promise.all([
        ctx.db.select().from(visits).orderBy(desc(visits.startsAt)),
        ctx.db.select().from(people).orderBy(asc(people.createdAt)),
        ctx.db.select().from(careItems).orderBy(asc(careItems.title)),
        ctx.db.select().from(providers).orderBy(asc(providers.name)),
        ctx.db.select().from(careOrganizations).orderBy(asc(careOrganizations.name)),
      ]);
    return {
      visits: allVisits,
      people: allPeople,
      careItems: allCareItems,
      providers: allProviders,
      organizations: allOrganizations,
    };
  }),

  create: publicProcedure.input(visitFieldsSchema).mutation(async ({ ctx, input }) => {
    const values = await validatedVisit(ctx, input);
    const [visit] = await ctx.db.insert(visits).values(values).returning();
    return visit!;
  }),

  update: publicProcedure
    .input(visitFieldsSchema.and(idInput))
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const values = await validatedVisit(ctx, fields);
      const [visit] = await ctx.db
        .update(visits)
        .set({ ...values, updatedAt: now() })
        .where(eq(visits.id, id))
        .returning();
      if (!visit) throw new TRPCError({ code: "NOT_FOUND", message: "Visit not found" });
      return visit;
    }),

  setStatus: publicProcedure
    .input(z.object({ id: z.string().uuid(), status: z.enum(visitStatuses) }))
    .mutation(async ({ ctx, input }) => {
      const [visit] = await ctx.db
        .update(visits)
        .set({ status: input.status, updatedAt: now() })
        .where(eq(visits.id, input.id))
        .returning();
      if (!visit) throw new TRPCError({ code: "NOT_FOUND", message: "Visit not found" });
      return visit;
    }),

  delete: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [visit] = await ctx.db.delete(visits).where(eq(visits.id, input.id)).returning();
    if (!visit) throw new TRPCError({ code: "NOT_FOUND", message: "Visit not found" });
    return visit;
  }),
});
