import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { mapAppErrors } from "~/core/infrastructure/trpc-errors";
import {
  getInvestmentSnapshotByDocument,
  listInvestmentSnapshotsByAccount,
  removeInvestmentSnapshot,
  reviewInvestmentSnapshot,
  saveInvestmentSnapshot,
} from "~/modules/investment-statements/application/investment-snapshot-service";
import { isInvestmentEligibleAccountType } from "~/modules/investment-statements/domain/account-eligibility";
import {
  isComparisonEligible,
  isGraphEligible,
} from "~/modules/investment-statements/domain/comparison";
import { createInvestmentStatementRepository } from "~/modules/investment-statements/infrastructure/investment-statement-repository";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  accounts,
  positionLineKinds,
  sectionCoverages,
  totalScopes,
} from "~/server/db/schema";

const nullableDecimal = z.string().trim().nullable();
const totalInput = z.object({
  currency: z.string().trim().min(3).max(3),
  scope: z.enum(totalScopes),
  closingValue: nullableDecimal,
  openingValue: nullableDecimal,
  cash: nullableDecimal,
  bookCost: nullableDecimal,
  contributions: nullableDecimal,
  withdrawals: nullableDecimal,
  transfersIn: nullableDecimal,
  transfersOut: nullableDecimal,
  income: nullableDecimal,
  fees: nullableDecimal,
  reportedValueChange: nullableDecimal,
  sourcePage: z.number().int().positive().nullable(),
  sourceNote: z.string().trim().max(500).nullable(),
});

const positionInput = z.object({
  instrumentId: z.string().uuid().nullable(),
  lineKind: z.enum(positionLineKinds),
  sourceLabel: z.string().trim().min(1).max(200),
  sourceIdentifier: z.string().trim().max(80).nullable(),
  sourceSeries: z.string().trim().max(80).nullable(),
  valueCurrency: z.string().trim().min(3).max(3),
  marketValue: nullableDecimal,
  quantity: nullableDecimal,
  unitPrice: nullableDecimal,
  unitPriceCurrency: z.string().trim().min(3).max(3).nullable(),
  bookCost: nullableDecimal,
  bookCostCurrency: z.string().trim().min(3).max(3).nullable(),
  sourcePage: z.number().int().positive().nullable(),
  sourceNote: z.string().trim().max(500).nullable(),
});

const saveInput = z.object({
  documentId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative().nullable(),
  valuationDate: z.string().trim().min(10).max(10),
  coverageStart: z.string().trim().min(10).max(10).nullable(),
  coverageEnd: z.string().trim().min(10).max(10).nullable(),
  summaryCoverage: z.enum(sectionCoverages),
  holdingsCoverage: z.enum(sectionCoverages),
  notes: z.string().trim().max(4000).nullable(),
  totals: z.array(totalInput),
  positions: z.array(positionInput),
});

export const investmentStatementsRouter = createTRPCRouter({
  getByDocument: publicProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      mapAppErrors(() =>
        getInvestmentSnapshotByDocument(
          createInvestmentStatementRepository(ctx.db),
          input.documentId,
        ),
      ),
    ),

  listByAccount: publicProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [account] = await ctx.db
        .select({ accountType: accounts.accountType })
        .from(accounts)
        .where(eq(accounts.id, input.accountId));
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found.",
        });
      }
      if (!isInvestmentEligibleAccountType(account.accountType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Investment history is only available for investment, TFSA, RRSP, and FHSA accounts.",
        });
      }

      const snapshots = await listInvestmentSnapshotsByAccount(
        createInvestmentStatementRepository(ctx.db),
        input.accountId,
      );

      return snapshots.map((snapshot) => ({
        ...snapshot,
        graphEligible: isGraphEligible(snapshot),
        comparisonEligible: isComparisonEligible(snapshot),
      }));
    }),

  save: publicProcedure
    .input(saveInput)
    .mutation(({ ctx, input }) =>
      mapAppErrors(() =>
        saveInvestmentSnapshot(
          createInvestmentStatementRepository(ctx.db),
          input,
        ),
      ),
    ),

  review: publicProcedure
    .input(
      z.object({
        documentId: z.string().uuid(),
        expectedRevision: z.number().int().nonnegative(),
      }),
    )
    .mutation(({ ctx, input }) =>
      mapAppErrors(() =>
        reviewInvestmentSnapshot(
          createInvestmentStatementRepository(ctx.db),
          input.documentId,
          input.expectedRevision,
        ),
      ),
    ),

  remove: publicProcedure
    .input(
      z.object({
        documentId: z.string().uuid(),
        expectedRevision: z.number().int().nonnegative(),
      }),
    )
    .mutation(({ ctx, input }) =>
      mapAppErrors(() =>
        removeInvestmentSnapshot(
          createInvestmentStatementRepository(ctx.db),
          input.documentId,
          input.expectedRevision,
        ),
      ),
    ),
});
