import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";

import {
  buildTaxDocumentReadiness,
  type TaxDocumentAttachmentAction,
  type TaxDocumentAttachmentInput,
  type TaxDocumentInput,
  type TaxDocumentUpdateInput,
} from "~/domain/tax-document";
import {
  people,
  taxDocumentAttachments,
  taxDocuments,
  taxItems,
} from "~/server/db/schema";
import type { Database } from "./helpers";
import { requireActiveYear, requireEditableActiveYear, requireHousehold } from "./helpers";

type TransactionDatabase = Parameters<Parameters<Database["transaction"]>[0]>[0];
type QueryDatabase = Database | TransactionDatabase;

async function activeContext(db: QueryDatabase) {
  const household = await requireHousehold(db as Database);
  const year = await requireActiveYear(db as Database, household.id);
  return { household, year };
}

async function editableContext(db: QueryDatabase) {
  const household = await requireHousehold(db as Database);
  const year = await requireEditableActiveYear(db as Database, household.id);
  return { household, year };
}

async function requireActiveTaxItem(db: QueryDatabase, taxItemId: number) {
  const { household, year } = await activeContext(db);
  const [item] = await db
    .select()
    .from(taxItems)
    .where(and(eq(taxItems.id, taxItemId), eq(taxItems.taxYearId, year.id)));
  if (!item) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Tax item not found." });
  }
  return { household, year, item };
}

async function requireEditableActiveTaxItem(db: QueryDatabase, taxItemId: number) {
  const { household, year } = await editableContext(db);
  const [item] = await db
    .select()
    .from(taxItems)
    .where(and(eq(taxItems.id, taxItemId), eq(taxItems.taxYearId, year.id)));
  if (!item) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Tax item not found." });
  }
  return { household, year, item };
}

async function normalizePerson(
  db: QueryDatabase,
  householdId: number,
  item: typeof taxItems.$inferSelect,
  personId: number | null,
) {
  if (item.ownerKind === "person") return item.personId;
  if (personId === null) return null;
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
  return person.id;
}

async function insertAttachment(
  db: QueryDatabase,
  taxDocumentId: number,
  attachment: TaxDocumentAttachmentInput,
) {
  await db
    .insert(taxDocumentAttachments)
    .values({ taxDocumentId, ...attachment });
}

export async function listActiveTaxDocuments(
  db: Database,
  taxItemId?: number,
) {
  const { year } = await activeContext(db);
  if (taxItemId !== undefined) await requireActiveTaxItem(db, taxItemId);
  const where = taxItemId === undefined
    ? eq(taxItems.taxYearId, year.id)
    : and(eq(taxItems.taxYearId, year.id), eq(taxDocuments.taxItemId, taxItemId));
  const items = await db
    .select({
      id: taxDocuments.id,
      taxItemId: taxDocuments.taxItemId,
      taxItemName: taxItems.name,
      taxItemOwnerKind: taxItems.ownerKind,
      type: taxDocuments.type,
      customTypeName: taxDocuments.customTypeName,
      issuer: taxDocuments.issuer,
      personId: taxDocuments.personId,
      personName: people.name,
      status: taxDocuments.status,
      notes: taxDocuments.notes,
      attachmentFileName: taxDocumentAttachments.fileName,
      attachmentMimeType: taxDocumentAttachments.mimeType,
      attachmentSizeBytes: taxDocumentAttachments.sizeBytes,
      createdAt: taxDocuments.createdAt,
      updatedAt: taxDocuments.updatedAt,
    })
    .from(taxDocuments)
    .innerJoin(taxItems, eq(taxDocuments.taxItemId, taxItems.id))
    .leftJoin(people, eq(taxDocuments.personId, people.id))
    .leftJoin(
      taxDocumentAttachments,
      eq(taxDocuments.id, taxDocumentAttachments.taxDocumentId),
    )
    .where(where)
    .orderBy(desc(taxDocuments.updatedAt), desc(taxDocuments.id));
  return { year, items };
}

export async function getTaxDocumentOverview(db: Database) {
  const { year, items } = await listActiveTaxDocuments(db);
  return { year, ...buildTaxDocumentReadiness(items) };
}

export async function createTaxDocument(
  db: Database,
  input: TaxDocumentInput,
  attachment: TaxDocumentAttachmentInput | null,
) {
  return db.transaction(async (tx) => {
    const { household, item } = await requireEditableActiveTaxItem(tx, input.taxItemId);
    const personId = await normalizePerson(
      tx,
      household.id,
      item,
      input.personId,
    );
    const [created] = await tx
      .insert(taxDocuments)
      .values({
        taxItemId: input.taxItemId,
        type: input.type,
        customTypeName: input.customTypeName,
        issuer: input.issuer,
        personId,
        status: attachment ? "received" : "expected",
        notes: input.notes,
      })
      .returning();
    if (attachment) await insertAttachment(tx, created!.id, attachment);
    return created!;
  });
}

async function requireActiveTaxDocument(
  db: QueryDatabase,
  taxDocumentId: number,
) {
  const { household, year } = await activeContext(db);
  const [row] = await db
    .select({ document: taxDocuments, item: taxItems })
    .from(taxDocuments)
    .innerJoin(taxItems, eq(taxDocuments.taxItemId, taxItems.id))
    .where(
      and(
        eq(taxDocuments.id, taxDocumentId),
        eq(taxItems.taxYearId, year.id),
      ),
    );
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Tax Document not found.",
    });
  }
  return { household, year, ...row };
}

async function requireEditableActiveTaxDocument(
  db: QueryDatabase,
  taxDocumentId: number,
) {
  const { household, year } = await editableContext(db);
  const [row] = await db
    .select({ document: taxDocuments, item: taxItems })
    .from(taxDocuments)
    .innerJoin(taxItems, eq(taxDocuments.taxItemId, taxItems.id))
    .where(
      and(
        eq(taxDocuments.id, taxDocumentId),
        eq(taxItems.taxYearId, year.id),
      ),
    );
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Tax Document not found.",
    });
  }
  return { household, year, ...row };
}

export async function updateTaxDocument(
  db: Database,
  taxDocumentId: number,
  input: TaxDocumentUpdateInput,
  attachmentAction: TaxDocumentAttachmentAction,
) {
  return db.transaction(async (tx) => {
    const { household, document, item } = await requireEditableActiveTaxDocument(
      tx,
      taxDocumentId,
    );
    const personId = await normalizePerson(
      tx,
      household.id,
      item,
      input.personId,
    );
    const status =
      input.status === "expected" && attachmentAction.type === "replace"
        ? "received"
        : input.status;
    const [updated] = await tx
      .update(taxDocuments)
      .set({ ...input, personId, status })
      .where(eq(taxDocuments.id, document.id))
      .returning();
    if (attachmentAction.type !== "keep") {
      await tx
        .delete(taxDocumentAttachments)
        .where(eq(taxDocumentAttachments.taxDocumentId, document.id));
    }
    if (attachmentAction.type === "replace") {
      await insertAttachment(tx, document.id, attachmentAction.attachment);
    }
    return updated!;
  });
}

export async function deleteTaxDocument(
  db: Database,
  taxDocumentId: number,
) {
  return db.transaction(async (tx) => {
    const { document } = await requireEditableActiveTaxDocument(tx, taxDocumentId);
    await tx.delete(taxDocuments).where(eq(taxDocuments.id, document.id));
    return { success: true };
  });
}

export async function getActiveTaxDocumentAttachment(
  db: Database,
  taxDocumentId: number,
) {
  await requireActiveTaxDocument(db, taxDocumentId);
  const [attachment] = await db
    .select()
    .from(taxDocumentAttachments)
    .where(eq(taxDocumentAttachments.taxDocumentId, taxDocumentId));
  if (!attachment) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Attachment not found." });
  }
  return attachment;
}
