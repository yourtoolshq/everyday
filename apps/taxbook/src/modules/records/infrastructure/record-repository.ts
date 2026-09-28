import { and, count, desc, eq, sum } from "drizzle-orm";

import type { FileTransaction } from "@yourtoolshq/data/files";
import {
  failedPrecondition,
  notFound,
} from "@yourtoolshq/server/errors";

import type { Database } from "~/server/api/helpers";
import {
  people,
  recordAttachments,
  records,
  taxItems,
} from "~/server/db/schema";

type RecordDatabase = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type QueryDatabase = Database | RecordDatabase;

const recordListColumns = {
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
  attachmentFileId: recordAttachments.fileId,
  createdAt: records.createdAt,
  updatedAt: records.updatedAt,
} as const;

async function requireHouseholdRow(db: QueryDatabase) {
  const household = await (db as Database).query.households.findFirst();
  if (!household) {
    throw failedPrecondition("Complete household setup first.");
  }
  return household;
}

async function requireActiveYearRow(db: QueryDatabase, householdId: number) {
  const year = await (db as Database).query.taxYears.findFirst({
    where: (table, operators) =>
      operators.and(
        operators.eq(table.householdId, householdId),
        operators.eq(table.isActive, true),
      ),
  });
  if (!year) {
    throw failedPrecondition("Choose an active tax year first.");
  }
  return year;
}

async function requireEditableActiveYearRow(
  db: QueryDatabase,
  householdId: number,
) {
  const year = await requireActiveYearRow(db, householdId);
  if (year.status === "archived") {
    throw failedPrecondition(
      "This tax year is archived. Change its lifecycle status before editing tracked data.",
    );
  }
  return year;
}

export function createRecordRepository(db: QueryDatabase) {
  return {
    async listByTaxItem(taxItemId: number) {
      const household = await requireHouseholdRow(db);
      const year = await requireActiveYearRow(db, household.id);
      const [item] = await db
        .select()
        .from(taxItems)
        .where(
          and(eq(taxItems.id, taxItemId), eq(taxItems.taxYearId, year.id)),
        );
      if (!item) {
        throw notFound("Tax item not found.");
      }

      const items = await db
        .select(recordListColumns)
        .from(records)
        .leftJoin(people, eq(records.personId, people.id))
        .leftJoin(recordAttachments, eq(records.id, recordAttachments.recordId))
        .where(eq(records.taxItemId, taxItemId))
        .orderBy(desc(records.date), desc(records.id));

      return { year, item, items };
    },

    async requireEditableRecord(recordId: number) {
      const household = await requireHouseholdRow(db);
      const year = await requireEditableActiveYearRow(db, household.id);
      const [row] = await db
        .select({
          recordId: records.id,
          taxItemId: records.taxItemId,
        })
        .from(records)
        .innerJoin(taxItems, eq(records.taxItemId, taxItems.id))
        .where(and(eq(records.id, recordId), eq(taxItems.taxYearId, year.id)));
      if (!row) {
        throw notFound("Record not found.");
      }
      return row;
    },

    async listAttachmentFileId(recordId: number) {
      const [attachment] = await db
        .select({ fileId: recordAttachments.fileId })
        .from(recordAttachments)
        .where(eq(recordAttachments.recordId, recordId));
      return attachment?.fileId ?? null;
    },

    async deleteRecordRow(recordId: number) {
      await db.delete(records).where(eq(records.id, recordId));
    },

    async syncRecordTotal(taxItemId: number) {
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
    },
  };
}

export type RecordRepository = ReturnType<typeof createRecordRepository>;

export type WithFiles = <T>(
  database: Database,
  work: (tx: RecordDatabase, files: FileTransaction) => Promise<T>,
) => Promise<T>;
