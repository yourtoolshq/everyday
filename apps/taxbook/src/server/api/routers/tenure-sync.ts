import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { fetchTenureEmployments, fetchTenureHealth } from "~/lib/tenure-client";
import { employments, households } from "~/server/db/schema";
import {
  requireActiveYear,
  requireEditableActiveYear,
  requireHousehold,
} from "../helpers";
import {
  importEmploymentsFromTenure,
  listTenureEmploymentLinks,
  reconcileEmploymentWithTenure,
  setTenurePersonMapping,
  syncTenurePaycheques,
} from "../tenure-sync";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const tenureSyncRouter = createTRPCRouter({
  status: publicProcedure.query(async ({ ctx }) => {
    const household = await requireHousehold(ctx.db);
    const health = await fetchTenureHealth(household.tenureBaseUrl);
    const year = await requireActiveYear(ctx.db, household.id);
    const linkedForYear = await ctx.db
      .select({ id: employments.id })
      .from(employments)
      .where(
        and(
          eq(employments.taxYearId, year.id),
          isNotNull(employments.tenureEmploymentId),
        ),
      );

    return {
      baseUrl: household.tenureBaseUrl,
      connected: health.ok,
      connectionError: health.error ?? null,
      lastSyncAt: household.tenureLastSyncAt,
      lastSyncError: household.tenureLastSyncError,
      linkedEmploymentCount: linkedForYear.length,
    };
  }),

  updateSettings: publicProcedure
    .input(z.object({ baseUrl: z.string().trim().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const household = await requireHousehold(ctx.db);
      await ctx.db
        .update(households)
        .set({ tenureBaseUrl: input.baseUrl.replace(/\/+$/, "") })
        .where(eq(households.id, household.id));
      return { success: true };
    }),

  testConnection: publicProcedure.mutation(async ({ ctx }) => {
    const household = await requireHousehold(ctx.db);
    const health = await fetchTenureHealth(household.tenureBaseUrl);
    if (!health.ok) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: health.error ?? "Unable to reach Tenure.",
      });
    }
    return { success: true };
  }),

  employmentLinks: publicProcedure.query(async ({ ctx }) => {
    const household = await requireHousehold(ctx.db);
    const year = await requireActiveYear(ctx.db, household.id);
    return listTenureEmploymentLinks(ctx.db, year.year);
  }),

  importEmployments: publicProcedure.mutation(async ({ ctx }) => {
    await requireEditableActiveYear(
      ctx.db,
      (await requireHousehold(ctx.db)).id,
    );
    return importEmploymentsFromTenure(ctx.db);
  }),

  setPersonMapping: publicProcedure
    .input(
      z.object({
        tenurePersonId: z.string().uuid(),
        taxbookPersonId: z.number().int().positive().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await setTenurePersonMapping(ctx.db, input);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Unable to save person mapping.",
        });
      }
    }),

  listTenureEmployments: publicProcedure.query(async ({ ctx }) => {
    const household = await requireHousehold(ctx.db);
    try {
      const items = await fetchTenureEmployments(household.tenureBaseUrl);
      return { items };
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Unable to load employments from Tenure.",
      });
    }
  }),

  linkEmployment: publicProcedure
    .input(
      z.object({
        employmentId: z.number().int().positive(),
        tenureEmploymentId: z.string().uuid().nullable(),
        reconcileExisting: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const household = await requireHousehold(ctx.db);
      const year = await requireEditableActiveYear(ctx.db, household.id);
      const [employment] = await ctx.db
        .select({ id: employments.id })
        .from(employments)
        .where(
          and(
            eq(employments.id, input.employmentId),
            eq(employments.taxYearId, year.id),
          ),
        );
      if (!employment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Employment not found.",
        });
      }

      await ctx.db
        .update(employments)
        .set({ tenureEmploymentId: input.tenureEmploymentId })
        .where(eq(employments.id, input.employmentId));

      if (input.tenureEmploymentId && input.reconcileExisting) {
        const result = await reconcileEmploymentWithTenure(
          ctx.db,
          input.employmentId,
        );
        return { success: true, matchedCount: result.matchedCount };
      }

      return { success: true, matchedCount: 0 };
    }),

  syncNow: publicProcedure
    .input(z.object({ fullRefresh: z.boolean().default(true) }).optional())
    .mutation(async ({ ctx, input }) => {
      await requireEditableActiveYear(
        ctx.db,
        (await requireHousehold(ctx.db)).id,
      );
      return syncTenurePaycheques(ctx.db, {
        fullRefresh: input?.fullRefresh ?? true,
      });
    }),
});
