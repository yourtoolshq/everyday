import {
  failedPrecondition,
  invalidInput,
  notFound,
} from "@yourtoolshq/server/errors";

import type { SaveSnapshotCommand } from "~/modules/investment-statements/domain/snapshot-dto";
import type { InvestmentStatementRepository } from "~/modules/investment-statements/infrastructure/investment-statement-repository";
import { isInvestmentEligibleAccountType } from "~/modules/investment-statements/domain/account-eligibility";
import {
  assertReviewReady,
  normalizeSaveCommand,
} from "~/modules/investment-statements/domain/validate-snapshot";

export async function getInvestmentSnapshotByDocument(
  repository: InvestmentStatementRepository,
  documentId: string,
) {
  const context = await repository.findDocumentContext(documentId);
  if (!context) throw notFound("Document not found.");
  if (context.type !== "statement") {
    throw failedPrecondition(
      "Only statement documents support investment details.",
    );
  }
  if (!isInvestmentEligibleAccountType(context.accountType)) {
    throw failedPrecondition(
      "Investment details are only available for investment, TFSA, RRSP, and FHSA accounts.",
    );
  }

  const snapshot = await repository.loadSnapshotByDocumentId(documentId);
  return {
    document: {
      id: context.documentId,
      accountId: context.accountId,
      accountName: context.accountName,
      accountType: context.accountType,
      title: context.title,
      periodKey: context.periodKey,
      documentDate: context.documentDate,
      fileId: context.fileId,
      mimeType: context.mimeType,
      originalFilename: context.originalFilename,
    },
    snapshot,
  };
}

export async function saveInvestmentSnapshot(
  repository: InvestmentStatementRepository,
  command: SaveSnapshotCommand,
) {
  const context = await repository.findDocumentContext(command.documentId);
  if (!context) throw notFound("Document not found.");
  if (context.type !== "statement") {
    throw invalidInput("Only statement documents support investment details.");
  }
  if (!isInvestmentEligibleAccountType(context.accountType)) {
    throw invalidInput(
      "Investment details are only available for investment, TFSA, RRSP, and FHSA accounts.",
    );
  }

  const normalized = normalizeSaveCommand(command);
  return repository.saveSnapshot(normalized);
}

export async function reviewInvestmentSnapshot(
  repository: InvestmentStatementRepository,
  documentId: string,
  expectedRevision: number,
) {
  const snapshot = await repository.loadSnapshotByDocumentId(documentId);
  if (!snapshot) throw notFound("Investment details not found.");
  assertReviewReady(
    snapshot.totals,
    snapshot.positions,
    snapshot.valuationDate,
  );
  return repository.reviewSnapshot(documentId, expectedRevision);
}

export async function removeInvestmentSnapshot(
  repository: InvestmentStatementRepository,
  documentId: string,
  expectedRevision: number,
) {
  return repository.removeSnapshot(documentId, expectedRevision);
}

export async function listInvestmentSnapshotsByAccount(
  repository: InvestmentStatementRepository,
  accountId: string,
) {
  return repository.listSnapshotsByAccountId(accountId);
}
