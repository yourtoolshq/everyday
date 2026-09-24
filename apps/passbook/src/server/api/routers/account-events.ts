import { TRPCError } from "@trpc/server";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import type { AccountTerms } from "~/lib/account-terms";
import {
  createAccountEventInputSchema,
  updateAccountEventInputSchema,
} from "~/lib/account-events";
import {
  accountTermsChanged,
  normalizeAccountTerms,
} from "~/lib/account-terms";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  accountEvents,
  accounts,
  accountTermsSnapshots,
  documents,
  institutions,
} from "~/server/db/schema";

const accountIdInput = z.object({ accountId: z.string().uuid() });
const overviewFilter = z.object({ accountId: z.string().uuid().optional() });
const idInput = z.object({ id: z.string().uuid() });

const now = () => new Date().toISOString();

const publicEventFields = {
  id: accountEvents.id,
  accountId: accountEvents.accountId,
  type: accountEvents.type,
  title: accountEvents.title,
  notes: accountEvents.notes,
  startDate: accountEvents.startDate,
  resolvedDate: accountEvents.resolvedDate,
  termsSnapshotId: accountEvents.termsSnapshotId,
  createdAt: accountEvents.createdAt,
  updatedAt: accountEvents.updatedAt,
};

const publicDocumentFields = {
  id: documents.id,
  eventId: documents.eventId,
  type: documents.type,
  title: documents.title,
  documentDate: documents.documentDate,
  notes: documents.notes,
  fileId: documents.fileId,
  originalFilename: documents.originalFilename,
  mimeType: documents.mimeType,
  sizeBytes: documents.sizeBytes,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
};

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

function snapshotValues(
  terms: AccountTerms,
  effectiveDate: string,
  notes: string | null,
) {
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

async function requireAccount(database: typeof db, accountId: string) {
  const [account] = await database
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, accountId));
  if (!account) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
  }
  return account;
}

async function requireEvent(database: typeof db, eventId: string) {
  const [event] = await database
    .select(publicEventFields)
    .from(accountEvents)
    .where(eq(accountEvents.id, eventId));
  if (!event) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Event not found." });
  }
  return event;
}

type EventDocument = {
  id: string;
  eventId: string | null;
  type: string;
  title: string;
  documentDate: string | null;
  notes: string | null;
  fileId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
};

async function documentsByEventIds(database: typeof db, eventIds: string[]) {
  const documentsByEvent = new Map<string, EventDocument[]>();
  if (eventIds.length === 0) return documentsByEvent;

  const rows = await database
    .select(publicDocumentFields)
    .from(documents)
    .where(inArray(documents.eventId, eventIds))
    .orderBy(desc(documents.createdAt));

  for (const row of rows) {
    if (!row.eventId) continue;
    const existing = documentsByEvent.get(row.eventId) ?? [];
    existing.push({ ...row, eventId: row.eventId });
    documentsByEvent.set(row.eventId, existing);
  }
  return documentsByEvent;
}

function withDocuments<T extends { id: string }>(
  events: T[],
  documentsByEvent: Map<string, EventDocument[]>,
) {
  return events.map((event) => ({
    ...event,
    documents: documentsByEvent.get(event.id) ?? [],
    // Keep `attachments` as an alias for existing UI during transition
    attachments: documentsByEvent.get(event.id) ?? [],
  }));
}

export const accountEventsRouter = createTRPCRouter({
  overview: publicProcedure
    .input(overviewFilter.optional())
    .query(async ({ ctx, input }) => {
      const baseQuery = ctx.db
        .select({
          ...publicEventFields,
          accountName: accounts.displayName,
          institutionName: institutions.name,
        })
        .from(accountEvents)
        .innerJoin(accounts, eq(accountEvents.accountId, accounts.id))
        .innerJoin(institutions, eq(accounts.institutionId, institutions.id));

      const events = input?.accountId
        ? await baseQuery
            .where(eq(accountEvents.accountId, input.accountId))
            .orderBy(
              desc(accountEvents.startDate),
              desc(accountEvents.createdAt),
            )
        : await baseQuery.orderBy(
            desc(accountEvents.startDate),
            desc(accountEvents.createdAt),
          );

      const documentsByEvent = await documentsByEventIds(
        ctx.db,
        events.map((event) => event.id),
      );
      return withDocuments(events, documentsByEvent);
    }),

  listByAccount: publicProcedure
    .input(accountIdInput)
    .query(async ({ ctx, input }) => {
      await requireAccount(ctx.db, input.accountId);

      const events = await ctx.db
        .select({
          ...publicEventFields,
          accountName: accounts.displayName,
          institutionName: institutions.name,
        })
        .from(accountEvents)
        .innerJoin(accounts, eq(accountEvents.accountId, accounts.id))
        .innerJoin(institutions, eq(accounts.institutionId, institutions.id))
        .where(eq(accountEvents.accountId, input.accountId))
        .orderBy(desc(accountEvents.startDate), desc(accountEvents.createdAt));

      const documentsByEvent = await documentsByEventIds(
        ctx.db,
        events.map((event) => event.id),
      );
      return withDocuments(events, documentsByEvent);
    }),

  get: publicProcedure.input(idInput).query(async ({ ctx, input }) => {
    const [event] = await ctx.db
      .select({
        ...publicEventFields,
        accountName: accounts.displayName,
        institutionName: institutions.name,
      })
      .from(accountEvents)
      .innerJoin(accounts, eq(accountEvents.accountId, accounts.id))
      .innerJoin(institutions, eq(accounts.institutionId, institutions.id))
      .where(eq(accountEvents.id, input.id));

    if (!event) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Event not found." });
    }

    const documentsByEvent = await documentsByEventIds(ctx.db, [event.id]);
    return withDocuments([event], documentsByEvent)[0]!;
  }),

  create: publicProcedure
    .input(createAccountEventInputSchema)
    .mutation(async ({ ctx, input }) => {
      await requireAccount(ctx.db, input.accountId);

      const termsChange = input.termsChange;
      if (
        termsChange?.recordTermsChange &&
        !termsChange.effectiveDate?.trim()
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose an effective date for the terms change.",
        });
      }

      const event = await ctx.db.transaction(async (tx) => {
        let termsSnapshotId: string | null = null;

        if (
          termsChange?.recordTermsChange &&
          termsChange.terms &&
          termsChange.effectiveDate
        ) {
          const terms = normalizeAccountTerms(termsChange.terms);
          const [existing] = await tx
            .select({
              id: accounts.id,
              interestRate: accounts.interestRate,
              promotionalInterestRate: accounts.promotionalInterestRate,
              promotionalInterestRateExpires:
                accounts.promotionalInterestRateExpires,
              creditLimit: accounts.creditLimit,
              annualFee: accounts.annualFee,
              renewalDate: accounts.renewalDate,
              insurance: accounts.insurance,
            })
            .from(accounts)
            .where(eq(accounts.id, input.accountId));
          if (!existing) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Account not found.",
            });
          }

          const changed = accountTermsChanged(
            termsFromAccount(existing),
            terms,
          );
          await tx
            .update(accounts)
            .set({
              interestRate: terms.interestRate,
              promotionalInterestRate: terms.promotionalInterestRate,
              promotionalInterestRateExpires:
                terms.promotionalInterestRateExpires,
              creditLimit: terms.creditLimit,
              annualFee: terms.annualFee,
              renewalDate: terms.renewalDate,
              insurance: terms.insurance,
              updatedAt: now(),
            })
            .where(eq(accounts.id, input.accountId));

          if (changed) {
            const [snapshot] = await tx
              .insert(accountTermsSnapshots)
              .values({
                accountId: input.accountId,
                ...snapshotValues(
                  terms,
                  termsChange.effectiveDate,
                  termsChange.snapshotNotes ?? null,
                ),
              })
              .returning({ id: accountTermsSnapshots.id });
            termsSnapshotId = snapshot?.id ?? null;
          }
        }

        const [created] = await tx
          .insert(accountEvents)
          .values({
            accountId: input.accountId,
            type: input.type,
            title: input.title,
            notes: input.notes ?? null,
            startDate: input.startDate,
            resolvedDate: input.resolvedDate ?? null,
            termsSnapshotId,
          })
          .returning(publicEventFields);

        if (!created) throw new Error("Event creation failed.");
        return created;
      });

      return event;
    }),

  update: publicProcedure
    .input(updateAccountEventInputSchema)
    .mutation(async ({ ctx, input }) => {
      await requireEvent(ctx.db, input.id);

      const [event] = await ctx.db
        .update(accountEvents)
        .set({
          type: input.type,
          title: input.title,
          notes: input.notes ?? null,
          startDate: input.startDate,
          resolvedDate: input.resolvedDate ?? null,
          updatedAt: now(),
        })
        .where(eq(accountEvents.id, input.id))
        .returning(publicEventFields);

      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found." });
      }

      return event;
    }),

  delete: publicProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    await requireEvent(ctx.db, input.id);
    await ctx.db.delete(accountEvents).where(eq(accountEvents.id, input.id));
    return { id: input.id };
  }),
});
