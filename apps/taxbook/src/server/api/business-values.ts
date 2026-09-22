import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import type { AttachmentAction, AttachmentInput } from "~/domain/record";
import type { BusinessRecordInput, BusinessRecordUpdateInput } from "~/domain/self-employment";
import { businessActivities, businessRecordAttachments, businessRecords, people, taxItems } from "~/server/db/schema";
import type { Database } from "./helpers";
import { requireActiveYear, requireEditableActiveYear, requireHousehold } from "./helpers";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type QueryDb = Database | Tx;

export async function requireActiveBusiness(db: QueryDb, id: number) {
  const household = await requireHousehold(db as Database);
  const year = await requireActiveYear(db as Database, household.id);
  const [activity] = await db.select().from(businessActivities).where(and(eq(businessActivities.id, id), eq(businessActivities.taxYearId, year.id)));
  if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "Self-employment business not found." });
  return { household, year, activity };
}

async function requireEditableActiveBusiness(db: QueryDb, id: number) {
  const household = await requireHousehold(db as Database);
  const year = await requireEditableActiveYear(db as Database, household.id);
  const [activity] = await db.select().from(businessActivities).where(and(eq(businessActivities.id, id), eq(businessActivities.taxYearId, year.id)));
  if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "Self-employment business not found." });
  return { household, year, activity };
}

export async function syncBusinessTaxItem(db: QueryDb, activityId: number) {
  const { activity } = await requireActiveBusiness(db, activityId);
  const rows = await db.select({ kind: businessRecords.kind, amountCents: businessRecords.amountCents }).from(businessRecords).where(eq(businessRecords.businessActivityId, activityId));
  const totals = rows.reduce((value, row) => row.kind === "revenue" ? { ...value, revenue: value.revenue + row.amountCents } : { ...value, expenses: value.expenses + row.amountCents }, { revenue: 0, expenses: 0 });
  await db.update(taxItems).set({ actualAmountCents: totals.revenue - totals.expenses, updatedAt: new Date() }).where(eq(taxItems.id, activity.taxItemId));
  return { ...totals, net: totals.revenue - totals.expenses };
}

export async function listBusinessActivities(db: Database) {
  const household = await requireHousehold(db);
  const year = await requireActiveYear(db, household.id);
  const rows = await db.select({ id: businessActivities.id, taxYearId: businessActivities.taxYearId, personId: businessActivities.personId, personName: people.name, taxItemId: businessActivities.taxItemId, name: businessActivities.name, createdAt: businessActivities.createdAt, updatedAt: businessActivities.updatedAt })
    .from(businessActivities).innerJoin(people, eq(businessActivities.personId, people.id)).where(eq(businessActivities.taxYearId, year.id)).orderBy(asc(people.sortOrder), asc(businessActivities.id));
  const allRecords = await db.select({ businessActivityId: businessRecords.businessActivityId, kind: businessRecords.kind, amountCents: businessRecords.amountCents }).from(businessRecords)
    .innerJoin(businessActivities, eq(businessRecords.businessActivityId, businessActivities.id)).where(eq(businessActivities.taxYearId, year.id));
  const items = rows.map((row) => {
    const totals = allRecords.filter((record) => record.businessActivityId === row.id).reduce((value, record) => record.kind === "revenue" ? { ...value, revenue: value.revenue + record.amountCents } : { ...value, expenses: value.expenses + record.amountCents }, { revenue: 0, expenses: 0 });
    return { ...row, totals: { ...totals, net: totals.revenue - totals.expenses } };
  });
  return { household, year, items };
}

export async function listBusinessRecords(db: Database, businessActivityId: number) {
  const { year, activity } = await requireActiveBusiness(db, businessActivityId);
  const items = await db.select({ id: businessRecords.id, businessActivityId: businessRecords.businessActivityId, kind: businessRecords.kind, expenseCategory: businessRecords.expenseCategory, date: businessRecords.date, description: businessRecords.description, amountCents: businessRecords.amountCents, notes: businessRecords.notes, attachmentFileName: businessRecordAttachments.fileName, attachmentMimeType: businessRecordAttachments.mimeType, attachmentSizeBytes: businessRecordAttachments.sizeBytes, createdAt: businessRecords.createdAt, updatedAt: businessRecords.updatedAt })
    .from(businessRecords).leftJoin(businessRecordAttachments, eq(businessRecords.id, businessRecordAttachments.businessRecordId)).where(eq(businessRecords.businessActivityId, businessActivityId)).orderBy(desc(businessRecords.date), desc(businessRecords.id));
  return { year, activity, items };
}

function validateYear(date: string, year: number) {
  if (!date.startsWith(`${year}-`)) throw new TRPCError({ code: "BAD_REQUEST", message: `The Record date must be in the ${year} tax year.` });
}
export async function createBusinessRecord(db: Database, input: BusinessRecordInput, attachment: AttachmentInput | null) {
  return db.transaction(async (tx) => {
    const { year } = await requireEditableActiveBusiness(tx, input.businessActivityId); validateYear(input.date, year.year);
    const [created] = await tx.insert(businessRecords).values(input).returning();
    if (attachment) await tx.insert(businessRecordAttachments).values({ businessRecordId: created!.id, ...attachment });
    await syncBusinessTaxItem(tx, input.businessActivityId); return created!;
  });
}
async function requireActiveBusinessRecord(db: QueryDb, id: number) {
  const household = await requireHousehold(db as Database); const year = await requireActiveYear(db as Database, household.id);
  const [row] = await db.select({ record: businessRecords, activity: businessActivities }).from(businessRecords).innerJoin(businessActivities, eq(businessRecords.businessActivityId, businessActivities.id)).where(and(eq(businessRecords.id, id), eq(businessActivities.taxYearId, year.id)));
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Self-employment Record not found." }); return { year, ...row };
}
async function requireEditableActiveBusinessRecord(db: QueryDb, id: number) {
  const household = await requireHousehold(db as Database); const year = await requireEditableActiveYear(db as Database, household.id);
  const [row] = await db.select({ record: businessRecords, activity: businessActivities }).from(businessRecords).innerJoin(businessActivities, eq(businessRecords.businessActivityId, businessActivities.id)).where(and(eq(businessRecords.id, id), eq(businessActivities.taxYearId, year.id)));
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Self-employment Record not found." }); return { year, ...row };
}
export async function updateBusinessRecord(db: Database, id: number, input: BusinessRecordUpdateInput, attachmentAction: AttachmentAction) {
  return db.transaction(async (tx) => {
    const { year, record } = await requireEditableActiveBusinessRecord(tx, id); validateYear(input.date, year.year);
    const [updated] = await tx.update(businessRecords).set(input).where(eq(businessRecords.id, id)).returning();
    if (attachmentAction.type !== "keep") await tx.delete(businessRecordAttachments).where(eq(businessRecordAttachments.businessRecordId, id));
    if (attachmentAction.type === "replace") await tx.insert(businessRecordAttachments).values({ businessRecordId: id, ...attachmentAction.attachment });
    await syncBusinessTaxItem(tx, record.businessActivityId); return updated!;
  });
}
export async function deleteBusinessRecord(db: Database, id: number) {
  return db.transaction(async (tx) => { const { record } = await requireEditableActiveBusinessRecord(tx, id); await tx.delete(businessRecords).where(eq(businessRecords.id, id)); await syncBusinessTaxItem(tx, record.businessActivityId); return { success: true }; });
}
export async function getBusinessRecordAttachment(db: Database, id: number) {
  await requireActiveBusinessRecord(db, id); const [attachment] = await db.select().from(businessRecordAttachments).where(eq(businessRecordAttachments.businessRecordId, id));
  if (!attachment) throw new TRPCError({ code: "NOT_FOUND", message: "Attachment not found." }); return attachment;
}
