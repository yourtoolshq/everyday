import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  accountTermsChanged,
  accountTermsSchema,
  normalizeAccountTerms,
  type AccountTerms,
} from "~/lib/account-terms";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import type { db as database } from "~/server/db";
import { accountTermsSnapshots, accounts } from "~/server/db/schema";

type Database = typeof database;

const accountIdInput = z.object({ accountId: z.string().uuid() });
const snapshotIdInput = z.object({ id: z.string().uuid() });

const snapshotInput = accountTermsSchema.extend({
  accountId: z.string().uuid(),
  effectiveDate: z.string().trim().min(1).max(10),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const now = () => new Date().toISOString();

function termsFromAccount(row: {
  interestRate: string | null;
  promotionalInterestRate: string | null;
  promotionalInterestRateExpires: string | null;
  creditLimit: string | null;
  annualFee: string | null;
  renewalDate: string | null;
  insurance: string | null;
}): AccountTerms {
  return normalizeAccountTerms({
    interestRate: row.interestRate,
    promotionalInterestRate: row.promotionalInterestRate,
    promotionalInterestRateExpires: row.promotionalInterestRateExpires,
    creditLimit: row.creditLimit,
    annualFee: row.annualFee,
    renewalDate: row.renewalDate,
    insurance: row.insurance,
  });
}

function termsFromSnapshot(row: typeof accountTermsSnapshots.$inferSelect): AccountTerms {
  return normalizeAccountTerms({
    interestRate: row.interestRate,
    promotionalInterestRate: row.promotionalInterestRate,
    promotionalInterestRateExpires: row.promotionalInterestRateExpires,
    creditLimit: row.creditLimit,
    annualFee: row.annualFee,
    renewalDate: row.renewalDate,
    insurance: row.insurance,
  });
}

function snapshotValues(terms: AccountTerms, effectiveDate: string, notes: string | null) {
  return {
    effectiveDate,
    interestRate: terms.interestRate,
    promotionalInterestRate: terms.promotionalInterestRate,
    promotionalInterestRateExpires: terms.promotionalInterestRateExpires,
    creditLimit: terms.creditLimit,
    annualFee: terms.annualFee,
    renewalDate: terms.renewalDate,
    insurance: terms.insurance,
    notes,
  };
}

async function requireAccount(db: Database, accountId: string) {
  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, accountId));
  if (!account) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
  }
  return account;
}

export const accountTermsRouter = createTRPCRouter({
  getCurrent: publicProcedure.input(accountIdInput).query(async ({ ctx, input }) => {
    const [account] = await ctx.db
      .select({
        interestRate: accounts.interestRate,
        promotionalInterestRate: accounts.promotionalInterestRate,
        promotionalInterestRateExpires: accounts.promotionalInterestRateExpires,
        creditLimit: accounts.creditLimit,
        annualFee: accounts.annualFee,
        renewalDate: accounts.renewalDate,
        insurance: accounts.insurance,
      })
      .from(accounts)
      .where(eq(accounts.id, input.accountId));

    if (!account) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
    }

    return termsFromAccount(account);
  }),

  listSnapshots: publicProcedure.input(accountIdInput).query(async ({ ctx, input }) => {
    await requireAccount(ctx.db, input.accountId);

    const rows = await ctx.db
      .select()
      .from(accountTermsSnapshots)
      .where(eq(accountTermsSnapshots.accountId, input.accountId))
      .orderBy(desc(accountTermsSnapshots.effectiveDate), desc(accountTermsSnapshots.createdAt));

    return rows.map((row) => ({
      id: row.id,
      accountId: row.accountId,
      effectiveDate: row.effectiveDate,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      terms: termsFromSnapshot(row),
    }));
  }),

  saveTerms: publicProcedure.input(snapshotInput).mutation(async ({ ctx, input }) => {
    const terms = normalizeAccountTerms(input);

    const account = await ctx.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: accounts.id,
          interestRate: accounts.interestRate,
          promotionalInterestRate: accounts.promotionalInterestRate,
          promotionalInterestRateExpires: accounts.promotionalInterestRateExpires,
          creditLimit: accounts.creditLimit,
          annualFee: accounts.annualFee,
          renewalDate: accounts.renewalDate,
          insurance: accounts.insurance,
        })
        .from(accounts)
        .where(eq(accounts.id, input.accountId));
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
      }

      const before = termsFromAccount(existing);
      const changed = accountTermsChanged(before, terms);

      const [updated] = await tx
        .update(accounts)
        .set({
          interestRate: terms.interestRate,
          promotionalInterestRate: terms.promotionalInterestRate,
          promotionalInterestRateExpires: terms.promotionalInterestRateExpires,
          creditLimit: terms.creditLimit,
          annualFee: terms.annualFee,
          renewalDate: terms.renewalDate,
          insurance: terms.insurance,
          updatedAt: now(),
        })
        .where(eq(accounts.id, input.accountId))
        .returning({ id: accounts.id });

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
      }

      if (changed) {
        await tx.insert(accountTermsSnapshots).values({
          accountId: input.accountId,
          ...snapshotValues(terms, input.effectiveDate, input.notes ?? null),
        });
      }

      return { accountId: updated.id, changed };
    });

    return account;
  }),

  addSnapshot: publicProcedure.input(snapshotInput).mutation(async ({ ctx, input }) => {
    await requireAccount(ctx.db, input.accountId);
    const terms = normalizeAccountTerms(input);

    const [snapshot] = await ctx.db
      .insert(accountTermsSnapshots)
      .values({
        accountId: input.accountId,
        ...snapshotValues(terms, input.effectiveDate, input.notes ?? null),
      })
      .returning();

    if (!snapshot) throw new Error("Snapshot creation failed.");
    return snapshot;
  }),

  updateSnapshot: publicProcedure
    .input(
      snapshotIdInput.extend({
        effectiveDate: z.string().trim().min(1).max(10),
        notes: z.string().trim().max(2000).nullable().optional(),
        terms: accountTermsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const terms = normalizeAccountTerms(input.terms);

      const [snapshot] = await ctx.db
        .update(accountTermsSnapshots)
        .set({
          ...snapshotValues(terms, input.effectiveDate, input.notes ?? null),
          updatedAt: now(),
        })
        .where(eq(accountTermsSnapshots.id, input.id))
        .returning();

      if (!snapshot) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Snapshot not found." });
      }

      return snapshot;
    }),

  deleteSnapshot: publicProcedure.input(snapshotIdInput).mutation(async ({ ctx, input }) => {
    const [snapshot] = await ctx.db
      .delete(accountTermsSnapshots)
      .where(eq(accountTermsSnapshots.id, input.id))
      .returning({ id: accountTermsSnapshots.id });

    if (!snapshot) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Snapshot not found." });
    }

    return snapshot;
  }),
});
