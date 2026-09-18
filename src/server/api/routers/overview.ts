import { and, asc, count, eq, isNotNull } from "drizzle-orm";

import { defaultStatementFrequency } from "~/lib/statement-frequency";
import {
  buildExceptionsByAccount,
  buildMissingStatements,
  buildYearCompletenessSummary,
} from "~/lib/statement-completeness";
import {
  accounts,
  documents,
  institutions,
  people,
  statementExpectations,
  statementPeriodExceptions,
} from "~/server/db/schema";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const overviewRouter = createTRPCRouter({
  summary: publicProcedure.query(async ({ ctx }) => {
    const [household] = await ctx.db.query.households.findMany({ limit: 1 });
    const [[memberCount], [institutionCount], [accountCount]] = await Promise.all([
      ctx.db.select({ value: count() }).from(people),
      ctx.db.select({ value: count() }).from(institutions),
      ctx.db.select({ value: count() }).from(accounts),
    ]);

    return {
      householdName: household?.name ?? null,
      memberCount: memberCount?.value ?? 0,
      institutionCount: institutionCount?.value ?? 0,
      accountCount: accountCount?.value ?? 0,
    };
  }),

  statementStatus: publicProcedure.query(async ({ ctx }) => {
    const accountRows = await ctx.db
      .select({
        id: accounts.id,
        displayName: accounts.displayName,
        institutionName: institutions.name,
        openedDate: accounts.openedDate,
        closedDate: accounts.closedDate,
        status: accounts.status,
        statementFrequency: statementExpectations.frequency,
      })
      .from(accounts)
      .innerJoin(institutions, eq(accounts.institutionId, institutions.id))
      .leftJoin(statementExpectations, eq(statementExpectations.accountId, accounts.id))
      .orderBy(asc(institutions.name), asc(accounts.displayName));

    const statementRows = await ctx.db
      .select({
        accountId: documents.accountId,
        periodKey: documents.periodKey,
        documentId: documents.id,
      })
      .from(documents)
      .where(and(eq(documents.type, "statement"), isNotNull(documents.periodKey)));

    const statementDocumentsByAccount: Record<string, Record<string, string>> = {};
    for (const row of statementRows) {
      if (!row.periodKey) continue;
      const accountDocuments = statementDocumentsByAccount[row.accountId] ?? {};
      accountDocuments[row.periodKey] = row.documentId;
      statementDocumentsByAccount[row.accountId] = accountDocuments;
    }

    const accountsForCompleteness = accountRows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      institutionName: row.institutionName,
      openedDate: row.openedDate,
      closedDate: row.closedDate,
      status: row.status,
      statementFrequency: row.statementFrequency ?? defaultStatementFrequency,
    }));

    const exceptionRows = await ctx.db
      .select({
        accountId: statementPeriodExceptions.accountId,
        periodKey: statementPeriodExceptions.periodKey,
      })
      .from(statementPeriodExceptions);
    const exceptionsByAccount = buildExceptionsByAccount(exceptionRows);

    const year = new Date().getFullYear();
    const yearSummary = buildYearCompletenessSummary(
      accountsForCompleteness,
      statementDocumentsByAccount,
      year,
      exceptionsByAccount,
    );
    const missingStatements = buildMissingStatements(
      accountsForCompleteness,
      statementDocumentsByAccount,
      exceptionsByAccount,
    );

    return {
      yearSummary,
      missingStatements,
    };
  }),
});
