import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { canMarkPeriodNotApplicable } from "~/lib/statement-period-exceptions";
import { defaultStatementFrequency } from "~/lib/statement-frequency";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import type { db as database } from "~/server/db";
import {
  accounts,
  documents,
  statementExpectations,
  statementPeriodExceptions,
} from "~/server/db/schema";

type Database = typeof database;

const accountIdInput = z.object({ accountId: z.string().uuid() });

const periodKeyInput = z.object({
  accountId: z.string().uuid(),
  periodKey: z.string().trim().min(1).max(20),
});

const now = () => new Date().toISOString();

async function getAccountForPeriodException(db: Database, accountId: string) {
  const [row] = await db
    .select({
      openedDate: accounts.openedDate,
      closedDate: accounts.closedDate,
      status: accounts.status,
      statementFrequency: statementExpectations.frequency,
    })
    .from(accounts)
    .leftJoin(statementExpectations, eq(statementExpectations.accountId, accounts.id))
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
  }

  return {
    openedDate: row.openedDate,
    closedDate: row.closedDate,
    status: row.status,
    statementFrequency: row.statementFrequency ?? defaultStatementFrequency,
  };
}

async function hasStatementDocument(db: Database, accountId: string, periodKey: string) {
  const [row] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.accountId, accountId),
        eq(documents.type, "statement"),
        eq(documents.periodKey, periodKey),
        isNotNull(documents.periodKey),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export const statementPeriodExceptionsRouter = createTRPCRouter({
  listByAccount: publicProcedure.input(accountIdInput).query(async ({ ctx, input }) => {
    return ctx.db
      .select({
        accountId: statementPeriodExceptions.accountId,
        periodKey: statementPeriodExceptions.periodKey,
        createdAt: statementPeriodExceptions.createdAt,
        updatedAt: statementPeriodExceptions.updatedAt,
      })
      .from(statementPeriodExceptions)
      .where(eq(statementPeriodExceptions.accountId, input.accountId))
      .orderBy(asc(statementPeriodExceptions.periodKey));
  }),

  listAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        accountId: statementPeriodExceptions.accountId,
        periodKey: statementPeriodExceptions.periodKey,
      })
      .from(statementPeriodExceptions)
      .orderBy(asc(statementPeriodExceptions.accountId), asc(statementPeriodExceptions.periodKey));
  }),

  create: publicProcedure.input(periodKeyInput).mutation(async ({ ctx, input }) => {
    const account = await getAccountForPeriodException(ctx.db, input.accountId);
    const hasDocument = await hasStatementDocument(ctx.db, input.accountId, input.periodKey);
    const validation = canMarkPeriodNotApplicable(account, input.periodKey, hasDocument);

    if (!validation.ok) {
      throw new TRPCError({ code: "BAD_REQUEST", message: validation.error });
    }

    await ctx.db
      .insert(statementPeriodExceptions)
      .values({
        accountId: input.accountId,
        periodKey: input.periodKey,
        updatedAt: now(),
      })
      .onConflictDoUpdate({
        target: [statementPeriodExceptions.accountId, statementPeriodExceptions.periodKey],
        set: { updatedAt: now() },
      });

    return { accountId: input.accountId, periodKey: input.periodKey };
  }),

  delete: publicProcedure.input(periodKeyInput).mutation(async ({ ctx, input }) => {
    const deleted = await ctx.db
      .delete(statementPeriodExceptions)
      .where(
        and(
          eq(statementPeriodExceptions.accountId, input.accountId),
          eq(statementPeriodExceptions.periodKey, input.periodKey),
        ),
      )
      .returning({ periodKey: statementPeriodExceptions.periodKey });

    if (deleted.length === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Period exception not found." });
    }

    return { accountId: input.accountId, periodKey: input.periodKey };
  }),
});
