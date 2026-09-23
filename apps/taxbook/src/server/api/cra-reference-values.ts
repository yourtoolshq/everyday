import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";

import type { Database } from "./helpers";
import type {
  CraReferenceAttachmentAction,
  CraReferenceAttachmentInput,
  CraReferenceInput,
  CraReferenceUpdateInput,
} from "~/domain/cra-reference";
import {
  craReferenceDocumentAttachments,
  craReferenceDocuments,
  people,
  taxYears,
} from "~/server/db/schema";
import { requireHousehold } from "./helpers";

type TransactionDatabase = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];
type QueryDatabase = Database | TransactionDatabase;

async function requireTaxYear(db: QueryDatabase, taxYearId: number) {
  const household = await requireHousehold(db as Database);
  const [year] = await db
    .select()
    .from(taxYears)
    .where(
      and(eq(taxYears.id, taxYearId), eq(taxYears.householdId, household.id)),
    );
  if (!year) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Tax year not found." });
  }
  return { household, year };
}

async function requirePerson(
  db: QueryDatabase,
  householdId: number,
  personId: number | null,
) {
  if (personId === null) return;
  const [person] = await db
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.id, personId), eq(people.householdId, householdId)));
  if (!person) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Choose a valid household member.",
    });
  }
}

async function requireCraReferenceDocument(
  db: QueryDatabase,
  documentId: number,
) {
  const household = await requireHousehold(db as Database);
  const [row] = await db
    .select({ document: craReferenceDocuments })
    .from(craReferenceDocuments)
    .innerJoin(taxYears, eq(craReferenceDocuments.taxYearId, taxYears.id))
    .where(
      and(
        eq(craReferenceDocuments.id, documentId),
        eq(taxYears.householdId, household.id),
      ),
    );
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "CRA reference document not found.",
    });
  }
  return { household, document: row.document };
}

async function insertAttachment(
  db: QueryDatabase,
  documentId: number,
  attachment: CraReferenceAttachmentInput,
) {
  await db.insert(craReferenceDocumentAttachments).values({
    craReferenceDocumentId: documentId,
    ...attachment,
  });
}

export async function listCraReferenceDocuments(
  db: Database,
  taxYearId: number,
) {
  await requireTaxYear(db, taxYearId);
  const items = await db
    .select({
      id: craReferenceDocuments.id,
      taxYearId: craReferenceDocuments.taxYearId,
      category: craReferenceDocuments.category,
      title: craReferenceDocuments.title,
      personId: craReferenceDocuments.personId,
      personName: people.name,
      documentDate: craReferenceDocuments.documentDate,
      reportingPeriodLabel: craReferenceDocuments.reportingPeriodLabel,
      notes: craReferenceDocuments.notes,
      attachmentFileName: craReferenceDocumentAttachments.fileName,
      attachmentMimeType: craReferenceDocumentAttachments.mimeType,
      attachmentSizeBytes: craReferenceDocumentAttachments.sizeBytes,
      createdAt: craReferenceDocuments.createdAt,
      updatedAt: craReferenceDocuments.updatedAt,
    })
    .from(craReferenceDocuments)
    .leftJoin(people, eq(craReferenceDocuments.personId, people.id))
    .leftJoin(
      craReferenceDocumentAttachments,
      eq(
        craReferenceDocuments.id,
        craReferenceDocumentAttachments.craReferenceDocumentId,
      ),
    )
    .where(eq(craReferenceDocuments.taxYearId, taxYearId))
    .orderBy(
      asc(craReferenceDocuments.category),
      desc(craReferenceDocuments.updatedAt),
      desc(craReferenceDocuments.id),
    );
  return { items };
}

export async function createCraReferenceDocument(
  db: Database,
  input: CraReferenceInput,
  attachment: CraReferenceAttachmentInput | null,
) {
  return db.transaction(async (tx) => {
    const { household } = await requireTaxYear(tx, input.taxYearId);
    await requirePerson(tx, household.id, input.personId);
    const [created] = await tx
      .insert(craReferenceDocuments)
      .values({
        taxYearId: input.taxYearId,
        category: input.category,
        title: input.title,
        personId: input.personId,
        documentDate: input.documentDate,
        reportingPeriodLabel: input.reportingPeriodLabel,
        notes: input.notes,
      })
      .returning();
    if (attachment) await insertAttachment(tx, created!.id, attachment);
    return created!;
  });
}

export async function updateCraReferenceDocument(
  db: Database,
  documentId: number,
  input: CraReferenceUpdateInput,
  attachmentAction: CraReferenceAttachmentAction,
) {
  return db.transaction(async (tx) => {
    const { household, document } = await requireCraReferenceDocument(
      tx,
      documentId,
    );
    await requirePerson(tx, household.id, input.personId);
    const [updated] = await tx
      .update(craReferenceDocuments)
      .set({
        category: input.category,
        title: input.title,
        personId: input.personId,
        documentDate: input.documentDate,
        reportingPeriodLabel: input.reportingPeriodLabel,
        notes: input.notes,
      })
      .where(eq(craReferenceDocuments.id, document.id))
      .returning();
    if (attachmentAction.type !== "keep") {
      await tx
        .delete(craReferenceDocumentAttachments)
        .where(
          eq(
            craReferenceDocumentAttachments.craReferenceDocumentId,
            document.id,
          ),
        );
    }
    if (attachmentAction.type === "replace") {
      await insertAttachment(tx, document.id, attachmentAction.attachment);
    }
    return updated!;
  });
}

export async function deleteCraReferenceDocument(
  db: Database,
  documentId: number,
) {
  return db.transaction(async (tx) => {
    const { document } = await requireCraReferenceDocument(tx, documentId);
    await tx
      .delete(craReferenceDocuments)
      .where(eq(craReferenceDocuments.id, document.id));
    return { success: true };
  });
}

export async function getCraReferenceDocumentAttachment(
  db: Database,
  documentId: number,
) {
  await requireCraReferenceDocument(db, documentId);
  const [attachment] = await db
    .select()
    .from(craReferenceDocumentAttachments)
    .where(
      eq(craReferenceDocumentAttachments.craReferenceDocumentId, documentId),
    );
  if (!attachment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Attachment not found.",
    });
  }
  return attachment;
}
