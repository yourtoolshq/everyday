import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";

import {
  assessmentKindForFiling,
  assertSubmittedCopyStatus,
  assertSubmittableCopyStatus,
  buildTaxYearLifecycleWarnings,
  type AssessmentInput,
  type FilingAttachmentAction,
  type FilingAttachmentInput,
  type OriginalReturnInput,
  type OriginalReturnUpdateInput,
  type TaxYearStatus,
} from "~/domain/filing";
import {
  assessmentAttachments,
  assessments,
  filingAttachments,
  filings,
  people,
  taxYears,
} from "~/server/db/schema";
import type { Database } from "./helpers";
import { requireHousehold } from "./helpers";

type TransactionDatabase = Parameters<Parameters<Database["transaction"]>[0]>[0];
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
  personId: number,
) {
  const [person] = await db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.householdId, householdId)));
  if (!person) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Choose a valid household member.",
    });
  }
  return person;
}

async function requireFiling(db: QueryDatabase, filingId: number) {
  const household = await requireHousehold(db as Database);
  const [row] = await db
    .select({
      filing: filings,
      year: taxYears,
    })
    .from(filings)
    .innerJoin(taxYears, eq(filings.taxYearId, taxYears.id))
    .where(
      and(eq(filings.id, filingId), eq(taxYears.householdId, household.id)),
    );
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Filing not found." });
  }
  return { household, year: row.year, filing: row.filing };
}

async function filingHasAttachment(db: QueryDatabase, filingId: number) {
  const [attachment] = await db
    .select({ filingId: filingAttachments.filingId })
    .from(filingAttachments)
    .where(eq(filingAttachments.filingId, filingId));
  return Boolean(attachment);
}

async function insertFilingAttachment(
  db: QueryDatabase,
  filingId: number,
  attachment: FilingAttachmentInput,
) {
  await db.insert(filingAttachments).values({ filingId, ...attachment });
}

async function applyFilingAttachmentAction(
  db: QueryDatabase,
  filingId: number,
  action: FilingAttachmentAction,
) {
  if (action.type === "keep") return;
  await db
    .delete(filingAttachments)
    .where(eq(filingAttachments.filingId, filingId));
  if (action.type === "replace") {
    await insertFilingAttachment(db, filingId, action.attachment);
  }
}

function validateSubmittedFiling(
  status: OriginalReturnUpdateInput["status"],
  returnCopyStatus: OriginalReturnUpdateInput["returnCopyStatus"],
  hasAttachment: boolean,
) {
  try {
    if (status === "submitted" || status === "assessed") {
      assertSubmittableCopyStatus(returnCopyStatus);
    }
    assertSubmittedCopyStatus(returnCopyStatus, hasAttachment);
  } catch (error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        error instanceof Error ? error.message : "Invalid filing details.",
    });
  }
}

export async function listFilingTimeline(db: Database, taxYearId: number) {
  const { household, year } = await requireTaxYear(db, taxYearId);
  const householdPeople = await db
    .select()
    .from(people)
    .where(eq(people.householdId, household.id))
    .orderBy(asc(people.sortOrder), asc(people.id));

  const rows = await db
    .select({
      id: filings.id,
      personId: filings.personId,
      personName: people.name,
      kind: filings.kind,
      status: filings.status,
      submissionDate: filings.submissionDate,
      expectedResultCents: filings.expectedResultCents,
      returnCopyStatus: filings.returnCopyStatus,
      notes: filings.notes,
      attachmentFileName: filingAttachments.fileName,
      attachmentMimeType: filingAttachments.mimeType,
      attachmentSizeBytes: filingAttachments.sizeBytes,
      assessmentId: assessments.id,
      assessmentKind: assessments.kind,
      assessmentDate: assessments.assessmentDate,
      assessedResultCents: assessments.assessedResultCents,
      refundOrPaymentDate: assessments.refundOrPaymentDate,
      assessmentNotes: assessments.notes,
      assessmentAttachmentFileName: assessmentAttachments.fileName,
      assessmentAttachmentMimeType: assessmentAttachments.mimeType,
      assessmentAttachmentSizeBytes: assessmentAttachments.sizeBytes,
      createdAt: filings.createdAt,
      updatedAt: filings.updatedAt,
    })
    .from(filings)
    .innerJoin(people, eq(filings.personId, people.id))
    .leftJoin(filingAttachments, eq(filings.id, filingAttachments.filingId))
    .leftJoin(assessments, eq(filings.id, assessments.filingId))
    .leftJoin(
      assessmentAttachments,
      eq(assessments.id, assessmentAttachments.assessmentId),
    )
    .where(eq(filings.taxYearId, year.id))
    .orderBy(asc(people.sortOrder), asc(people.id), asc(filings.submissionDate), asc(filings.id));

  return { year, people: householdPeople, filings: rows };
}

export async function createOriginalReturn(
  db: Database,
  taxYearId: number,
  input: OriginalReturnInput,
  attachment: FilingAttachmentInput | null,
) {
  const { household, year } = await requireTaxYear(db, taxYearId);
  await requirePerson(db, household.id, input.personId);

  const existing = await db.query.filings.findFirst({
    where: (table, operators) =>
      operators.and(
        operators.eq(table.taxYearId, year.id),
        operators.eq(table.personId, input.personId),
        operators.eq(table.kind, "original_return"),
      ),
  });
  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This person already has an original return for the year.",
    });
  }

  const returnCopyStatus =
    attachment !== null ? "attached" : input.returnCopyStatus;
  assertSubmittedCopyStatus(returnCopyStatus, attachment !== null);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(filings)
      .values({
        taxYearId: year.id,
        personId: input.personId,
        kind: "original_return",
        status: "preparing",
        submissionDate: input.submissionDate,
        expectedResultCents: input.expectedResultCents,
        returnCopyStatus,
        notes: input.notes,
      })
      .returning();
    if (attachment) {
      await insertFilingAttachment(tx, created!.id, attachment);
    }
    return created!;
  });
}

export async function updateOriginalReturn(
  db: Database,
  filingId: number,
  input: OriginalReturnUpdateInput,
  attachmentAction: FilingAttachmentAction,
) {
  const { filing } = await requireFiling(db, filingId);
  if (filing.kind !== "original_return") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only an original return can be updated here.",
    });
  }

  let returnCopyStatus = input.returnCopyStatus;
  if (attachmentAction.type === "replace") returnCopyStatus = "attached";
  if (attachmentAction.type === "unavailable") returnCopyStatus = "unavailable";
  if (attachmentAction.type === "remove") {
    returnCopyStatus =
      filing.status === "submitted" || filing.status === "assessed"
        ? "unavailable"
        : "not_added_yet";
  }

  const hasAttachmentBefore = await filingHasAttachment(db, filingId);
  const hasAttachmentAfter =
    attachmentAction.type === "replace"
      ? true
      : attachmentAction.type === "remove" ||
          attachmentAction.type === "unavailable"
        ? false
        : hasAttachmentBefore;

  validateSubmittedFiling(input.status, returnCopyStatus, hasAttachmentAfter);

  return db.transaction(async (tx) => {
    await applyFilingAttachmentAction(tx, filingId, attachmentAction);
    const [updated] = await tx
      .update(filings)
      .set({
        submissionDate: input.submissionDate,
        expectedResultCents: input.expectedResultCents,
        returnCopyStatus,
        notes: input.notes,
        status: input.status === "assessed" ? "assessed" : input.status,
      })
      .where(eq(filings.id, filingId))
      .returning();
    return updated!;
  });
}

export async function deleteOriginalReturn(db: Database, filingId: number) {
  const { filing } = await requireFiling(db, filingId);
  if (filing.kind !== "original_return") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only an original return can be deleted here.",
    });
  }
  const assessment = await db.query.assessments.findFirst({
    where: (table, operators) => operators.eq(table.filingId, filingId),
  });
  if (assessment) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Remove the assessment before deleting this filing.",
    });
  }
  await db.delete(filings).where(eq(filings.id, filingId));
  return { success: true as const };
}

export async function createAssessment(
  db: Database,
  filingId: number,
  input: AssessmentInput,
  attachment: FilingAttachmentInput | null,
) {
  const { filing } = await requireFiling(db, filingId);
  const existing = await db.query.assessments.findFirst({
    where: (table, operators) => operators.eq(table.filingId, filingId),
  });
  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This filing already has an assessment.",
    });
  }

  const kind = assessmentKindForFiling(filing.kind);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(assessments)
      .values({
        filingId,
        kind,
        assessmentDate: input.assessmentDate,
        assessedResultCents: input.assessedResultCents,
        refundOrPaymentDate: input.refundOrPaymentDate,
        notes: input.notes,
      })
      .returning();
    if (attachment) {
      await tx.insert(assessmentAttachments).values({
        assessmentId: created!.id,
        ...attachment,
      });
    }
    await tx
      .update(filings)
      .set({ status: "assessed" })
      .where(eq(filings.id, filingId));
    return created!;
  });
}

export async function updateAssessment(
  db: Database,
  assessmentId: number,
  input: AssessmentInput,
  attachmentAction: FilingAttachmentAction,
) {
  const household = await requireHousehold(db);
  const [row] = await db
    .select({ assessment: assessments })
    .from(assessments)
    .innerJoin(filings, eq(assessments.filingId, filings.id))
    .innerJoin(taxYears, eq(filings.taxYearId, taxYears.id))
    .where(
      and(
        eq(assessments.id, assessmentId),
        eq(taxYears.householdId, household.id),
      ),
    );
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found." });
  }

  return db.transaction(async (tx) => {
    if (attachmentAction.type !== "keep") {
      await tx
        .delete(assessmentAttachments)
        .where(eq(assessmentAttachments.assessmentId, assessmentId));
      if (attachmentAction.type === "replace") {
        await tx.insert(assessmentAttachments).values({
          assessmentId,
          ...attachmentAction.attachment,
        });
      }
    }
    const [updated] = await tx
      .update(assessments)
      .set({
        assessmentDate: input.assessmentDate,
        assessedResultCents: input.assessedResultCents,
        refundOrPaymentDate: input.refundOrPaymentDate,
        notes: input.notes,
      })
      .where(eq(assessments.id, assessmentId))
      .returning();
    return updated!;
  });
}

export async function deleteAssessment(db: Database, assessmentId: number) {
  const household = await requireHousehold(db);
  const [row] = await db
    .select({ assessment: assessments, filingId: filings.id })
    .from(assessments)
    .innerJoin(filings, eq(assessments.filingId, filings.id))
    .innerJoin(taxYears, eq(filings.taxYearId, taxYears.id))
    .where(
      and(
        eq(assessments.id, assessmentId),
        eq(taxYears.householdId, household.id),
      ),
    );
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found." });
  }

  return db.transaction(async (tx) => {
    await tx.delete(assessments).where(eq(assessments.id, assessmentId));
    await tx
      .update(filings)
      .set({ status: "submitted" })
      .where(eq(filings.id, row.filingId));
    return { success: true as const };
  });
}

export async function getFilingAttachment(db: Database, filingId: number) {
  await requireFiling(db, filingId);
  const [attachment] = await db
    .select()
    .from(filingAttachments)
    .where(eq(filingAttachments.filingId, filingId));
  if (!attachment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Filing attachment not found.",
    });
  }
  return attachment;
}

export async function getAssessmentAttachment(db: Database, assessmentId: number) {
  const household = await requireHousehold(db);
  const [row] = await db
    .select({ attachment: assessmentAttachments })
    .from(assessmentAttachments)
    .innerJoin(
      assessments,
      eq(assessmentAttachments.assessmentId, assessments.id),
    )
    .innerJoin(filings, eq(assessments.filingId, filings.id))
    .innerJoin(taxYears, eq(filings.taxYearId, taxYears.id))
    .where(
      and(
        eq(assessments.id, assessmentId),
        eq(taxYears.householdId, household.id),
      ),
    );
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Assessment attachment not found.",
    });
  }
  return row.attachment;
}

export async function updateTaxYearStatus(
  db: Database,
  taxYearId: number,
  status: TaxYearStatus,
) {
  const { year } = await requireTaxYear(db, taxYearId);
  const timeline = await listFilingTimeline(db, taxYearId);
  const warnings = buildTaxYearLifecycleWarnings({
    targetStatus: status,
    filings: timeline.filings.map((filing) => ({
      kind: filing.kind,
      status: filing.status,
      hasAssessment: filing.assessmentId !== null,
    })),
  });
  const [updated] = await db
    .update(taxYears)
    .set({ status })
    .where(eq(taxYears.id, year.id))
    .returning();
  return { year: updated!, warnings };
}
