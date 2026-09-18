import { TRPCError } from "@trpc/server";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { accountStatuses } from "~/lib/account-status";
import { accountTypes } from "~/lib/account-types";
import {
  defaultStatementFrequency,
  statementFrequencies,
} from "~/lib/statement-frequency";
import {
  accountOwnership,
  accounts,
  institutions,
  people,
  statementExpectations,
} from "~/server/db/schema";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const accountInput = z
  .object({
    institutionId: z.string().uuid(),
    displayName: z.string().trim().min(1).max(160),
    accountType: z.enum(accountTypes),
    identifierSuffix: z.string().trim().max(20).nullable().optional(),
    status: z.enum(accountStatuses).default("active"),
    openedDate: z.string().trim().max(10).nullable().optional(),
    closedDate: z.string().trim().max(10).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    ownerIds: z.array(z.string().uuid()).min(1),
  })
  .superRefine((data, ctx) => {
    if (data.status === "closed" && !data.closedDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Closed accounts need a closed date.",
        path: ["closedDate"],
      });
    }
    if (data.status === "active" && data.closedDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Active accounts cannot have a closed date.",
        path: ["closedDate"],
      });
    }
  });

const idInput = z.object({ id: z.string().uuid() });
const now = () => new Date().toISOString();

export const accountsRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: accounts.id,
        displayName: accounts.displayName,
        accountType: accounts.accountType,
        identifierSuffix: accounts.identifierSuffix,
        status: accounts.status,
        openedDate: accounts.openedDate,
        closedDate: accounts.closedDate,
        notes: accounts.notes,
        institutionId: institutions.id,
        institutionName: institutions.name,
        statementFrequency: statementExpectations.frequency,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
      })
      .from(accounts)
      .innerJoin(institutions, eq(accounts.institutionId, institutions.id))
      .leftJoin(statementExpectations, eq(statementExpectations.accountId, accounts.id))
      .orderBy(asc(institutions.name), asc(accounts.displayName));

    const ownership = await ctx.db
      .select({
        accountId: accountOwnership.accountId,
        personId: people.id,
        personName: people.displayName,
      })
      .from(accountOwnership)
      .innerJoin(people, eq(accountOwnership.personId, people.id));

    const ownersByAccount = new Map<string, { id: string; displayName: string }[]>();
    for (const row of ownership) {
      const current = ownersByAccount.get(row.accountId) ?? [];
      current.push({ id: row.personId, displayName: row.personName });
      ownersByAccount.set(row.accountId, current);
    }

    return rows.map((row) => ({
      ...row,
      statementFrequency: row.statementFrequency ?? defaultStatementFrequency,
      owners: ownersByAccount.get(row.id) ?? [],
    }));
  }),

  create: publicProcedure.input(accountInput).mutation(async ({ ctx, input }) => {
    const [institution] = await ctx.db
      .select({ id: institutions.id })
      .from(institutions)
      .where(eq(institutions.id, input.institutionId));
    if (!institution) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Institution not found." });
    }

    const owners = await ctx.db.query.people.findMany({
      where: inArray(people.id, input.ownerIds),
    });
    if (owners.length !== input.ownerIds.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Choose valid household members." });
    }

    const account = await ctx.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(accounts)
        .values({
          institutionId: input.institutionId,
          displayName: input.displayName,
          accountType: input.accountType,
          identifierSuffix: input.identifierSuffix ?? null,
          status: input.status,
          openedDate: input.openedDate ?? null,
          closedDate: input.closedDate ?? null,
          notes: input.notes ?? null,
        })
        .returning();
      if (!created) throw new Error("Account creation failed.");

      await tx.insert(accountOwnership).values(
        input.ownerIds.map((personId) => ({
          accountId: created.id,
          personId,
        })),
      );

      await tx.insert(statementExpectations).values({
        accountId: created.id,
        frequency: defaultStatementFrequency,
      });

      return created;
    });

    return account;
  }),

  update: publicProcedure
    .input(idInput.and(accountInput))
    .mutation(async ({ ctx, input }) => {
      const owners = await ctx.db.query.people.findMany({
        where: inArray(people.id, input.ownerIds),
      });
      if (owners.length !== input.ownerIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose valid household members." });
      }

      const account = await ctx.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(accounts)
          .set({
            institutionId: input.institutionId,
            displayName: input.displayName,
            accountType: input.accountType,
            identifierSuffix: input.identifierSuffix ?? null,
            status: input.status,
            openedDate: input.openedDate ?? null,
            closedDate: input.closedDate ?? null,
            notes: input.notes ?? null,
            updatedAt: now(),
          })
          .where(eq(accounts.id, input.id))
          .returning();
        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
        }

        await tx.delete(accountOwnership).where(eq(accountOwnership.accountId, input.id));
        await tx.insert(accountOwnership).values(
          input.ownerIds.map((personId) => ({
            accountId: input.id,
            personId,
          })),
        );

        return updated;
      });

      return account;
    }),

  updateStatementSchedule: publicProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        frequency: z.enum(statementFrequencies),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [account] = await ctx.db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.id, input.accountId));
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
      }

      await ctx.db
        .insert(statementExpectations)
        .values({
          accountId: input.accountId,
          frequency: input.frequency,
        })
        .onConflictDoUpdate({
          target: statementExpectations.accountId,
          set: {
            frequency: input.frequency,
            updatedAt: now(),
          },
        });

      return { accountId: input.accountId, frequency: input.frequency };
    }),

  delete: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [account] = await ctx.db
      .delete(accounts)
      .where(eq(accounts.id, input.id))
      .returning({ id: accounts.id });
    if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
    return account;
  }),
});
