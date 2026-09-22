import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, sum } from "drizzle-orm";

import type { Database } from "./helpers";
import type {
  AttachmentAction,
  AttachmentInput,
  RecordInput,
  RecordUpdateInput,
} from "~/domain/record";
import {
  people,
  recordAttachments,
  records,
  taxItems,
} from "~/server/db/schema";
import {
  requireActiveYear,
  requireEditableActiveYear,
  requireHousehold,
} from "./helpers";

type RecordDatabase = Parameters<Parameters<Database["transaction"]>[0]>[0];
type QueryDatabase = Database | RecordDatabase;

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

export async function requireActiveTaxItem(
  db: QueryDatabase,
  taxItemId: number,
) {
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

async function requireEditableActiveTaxItem(
  db: QueryDatabase,
  taxItemId: number,
) {
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
  recordId: number,
  attachment: AttachmentInput,
) {
  await db.insert(recordAttachments).values({ recordId, ...attachment });
}

async function syncRecordTotal(db: QueryDatabase, taxItemId: number) {
  const [aggregate] = await db
    .select({ total: sum(records.amountCents), totalRecords: count() })
    .from(records)
    .where(eq(records.taxItemId, taxItemId));
  const totalRecords = aggregate?.totalRecords ?? 0;
  await db
    .update(taxItems)
    .set(
      totalRecords === 0
        ? { valueSource: "manual", actualAmountCents: null }
        : {
            valueSource: "records",
            actualAmountCents: Number(aggregate?.total ?? 0),
          },
    )
    .where(eq(taxItems.id, taxItemId));
}

export async function listActiveRecords(db: Database, taxItemId: number) {
  const { year, item } = await requireActiveTaxItem(db, taxItemId);
  const items = await db
    .select({
      id: records.id,
      taxItemId: records.taxItemId,
      date: records.date,
      description: records.description,
      amountCents: records.amountCents,
      personId: records.personId,
      personName: people.name,
      notes: records.notes,
      attachmentFileName: recordAttachments.fileName,
      attachmentMimeType: recordAttachments.mimeType,
      attachmentSizeBytes: recordAttachments.sizeBytes,
      createdAt: records.createdAt,
      updatedAt: records.updatedAt,
    })
    .from(records)
    .leftJoin(people, eq(records.personId, people.id))
    .leftJoin(recordAttachments, eq(records.id, recordAttachments.recordId))
    .where(eq(records.taxItemId, taxItemId))
    .orderBy(desc(records.date), desc(records.id));
  return { year, item, items };
}

export async function createRecord(
  db: Database,
  input: RecordInput,
  attachment: AttachmentInput | null,
) {
  return db.transaction(async (tx) => {
    const { household, item } = await requireEditableActiveTaxItem(
      tx,
      input.taxItemId,
    );
    if (
      item.valueSource === "paycheques" ||
      item.valueSource === "self_employment"
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Calculated Tax Items cannot have supporting Records here.",
      });
    }
    if (
      item.valueSource === "manual" &&
      item.actualAmountCents !== null &&
      !input.confirmReplaceActual
    ) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Confirm that Records should replace the current actual amount.",
      });
    }
    const personId = await normalizePerson(
      tx,
      household.id,
      item,
      input.personId,
    );
    const [created] = await tx
      .insert(records)
      .values({
        taxItemId: input.taxItemId,
        date: input.date,
        description: input.description,
        amountCents: input.amountCents,
        personId,
        notes: input.notes,
      })
      .returning();
    if (attachment) await insertAttachment(tx, created!.id, attachment);
    await syncRecordTotal(tx, input.taxItemId);
    return created!;
  });
}

async function requireActiveRecord(db: QueryDatabase, recordId: number) {
  const { household, year } = await activeContext(db);
  const [row] = await db
    .select({ record: records, item: taxItems })
    .from(records)
    .innerJoin(taxItems, eq(records.taxItemId, taxItems.id))
    .where(and(eq(records.id, recordId), eq(taxItems.taxYearId, year.id)));
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Record not found." });
  }
  return { household, year, ...row };
}

async function requireEditableActiveRecord(
  db: QueryDatabase,
  recordId: number,
) {
  const { household, year } = await editableContext(db);
  const [row] = await db
    .select({ record: records, item: taxItems })
    .from(records)
    .innerJoin(taxItems, eq(records.taxItemId, taxItems.id))
    .where(and(eq(records.id, recordId), eq(taxItems.taxYearId, year.id)));
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Record not found." });
  }
  return { household, year, ...row };
}

export async function updateRecord(
  db: Database,
  recordId: number,
  input: RecordUpdateInput,
  attachmentAction: AttachmentAction,
) {
  return db.transaction(async (tx) => {
    const { household, record, item } = await requireEditableActiveRecord(
      tx,
      recordId,
    );
    const personId = await normalizePerson(
      tx,
      household.id,
      item,
      input.personId,
    );
    const [updated] = await tx
      .update(records)
      .set({ ...input, personId })
      .where(eq(records.id, recordId))
      .returning();
    if (attachmentAction.type !== "keep") {
      await tx
        .delete(recordAttachments)
        .where(eq(recordAttachments.recordId, recordId));
    }
    if (attachmentAction.type === "replace") {
      await insertAttachment(tx, recordId, attachmentAction.attachment);
    }
    await syncRecordTotal(tx, record.taxItemId);
    return updated!;
  });
}

export async function deleteRecord(db: Database, recordId: number) {
  return db.transaction(async (tx) => {
    const { record } = await requireEditableActiveRecord(tx, recordId);
    await tx.delete(records).where(eq(records.id, recordId));
    await syncRecordTotal(tx, record.taxItemId);
    return { success: true };
  });
}

export async function getActiveAttachment(db: Database, recordId: number) {
  await requireActiveRecord(db, recordId);
  const [attachment] = await db
    .select()
    .from(recordAttachments)
    .where(eq(recordAttachments.recordId, recordId));
  if (!attachment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Attachment not found.",
    });
  }
  return attachment;
}
