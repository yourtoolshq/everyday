import { TRPCError } from "@trpc/server";

import type { AccountType } from "~/lib/account-types";
import type { DocumentType } from "~/lib/documents";
import type { db as passbookDb } from "~/server/db";
import { isInvestmentEligibleAccountType } from "~/modules/investment-statements/domain/account-eligibility";
import { createInvestmentStatementRepository } from "~/modules/investment-statements/infrastructure/investment-statement-repository";

type PassbookDatabase = Pick<
  typeof passbookDb,
  "select" | "insert" | "update" | "delete" | "transaction"
>;

export function documentMetadataInvalidatesInvestmentReview(input: {
  previousPeriodKey: string | null;
  nextPeriodKey: string | null;
  previousDocumentDate: string | null;
  nextStoredDocumentDate: string | null;
}): boolean {
  const periodChanged =
    (input.previousPeriodKey ?? null) !== (input.nextPeriodKey ?? null);
  const dateChanged =
    (input.previousDocumentDate ?? null) !==
    (input.nextStoredDocumentDate ?? null);
  return periodChanged || dateChanged;
}

export async function assertDocumentUpdateAllowsInvestmentEnrichment(
  db: PassbookDatabase,
  input: {
    documentId: string;
    nextType: DocumentType;
    previousType: DocumentType;
  },
) {
  const repository = createInvestmentStatementRepository(db);
  const hasEnrichment = await repository.documentHasInvestmentEnrichment(
    input.documentId,
  );
  if (!hasEnrichment) return;

  if (input.nextType !== "statement") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Remove investment details before changing this document away from a statement.",
    });
  }
}

export async function invalidateInvestmentReviewAfterDocumentMetadataChange(
  db: PassbookDatabase,
  input: {
    documentId: string;
    previousPeriodKey: string | null;
    nextPeriodKey: string | null;
    previousDocumentDate: string | null;
    nextStoredDocumentDate: string | null;
  },
) {
  if (
    !documentMetadataInvalidatesInvestmentReview({
      previousPeriodKey: input.previousPeriodKey,
      nextPeriodKey: input.nextPeriodKey,
      previousDocumentDate: input.previousDocumentDate,
      nextStoredDocumentDate: input.nextStoredDocumentDate,
    })
  ) {
    return;
  }

  const repository = createInvestmentStatementRepository(db);
  const hasEnrichment = await repository.documentHasInvestmentEnrichment(
    input.documentId,
  );
  if (!hasEnrichment) return;

  await repository.invalidateReviewForDocument(input.documentId);
}

export async function assertAccountUpdateAllowsInvestmentEnrichment(
  db: PassbookDatabase,
  input: {
    accountId: string;
    nextAccountType: AccountType;
  },
) {
  if (isInvestmentEligibleAccountType(input.nextAccountType)) return;

  const repository = createInvestmentStatementRepository(db);
  const hasEnrichment = await repository.accountHasInvestmentEnrichment(
    input.accountId,
  );
  if (hasEnrichment) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Remove investment details from this account's statements before changing its type.",
    });
  }
}
