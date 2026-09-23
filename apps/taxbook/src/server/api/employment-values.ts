import { asc, eq } from "drizzle-orm";

import type { Database } from "./helpers";
import { calculateEmploymentProjection } from "~/domain/employment";
import {
  employments,
  paycheques,
  taxItems,
  taxYears,
} from "~/server/db/schema";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseWriter = Database | Transaction;

type EmploymentRow = typeof employments.$inferSelect;

function phspTaxItemName(employerName: string) {
  return `PHSP premiums — ${employerName}`;
}

function unionDuesTaxItemName(employerName: string) {
  return `Union dues — ${employerName}`;
}

async function createPhspTaxItem(
  db: DatabaseWriter,
  taxYearId: number,
  employerName: string,
) {
  const [item] = await db
    .insert(taxItems)
    .values({
      taxYearId,
      name: phspTaxItemName(employerName),
      taxLineReference: "T4 code 85 → 33099 / 58689",
      type: "eligible_expense",
      ownerKind: "household",
      personId: null,
      expectedAmountCents: null,
      actualAmountCents: 0,
      status: "in_progress",
      valueSource: "paycheques",
      taxTreatment: "medical_expense",
      notes: null,
    })
    .returning();
  return item!;
}

async function createUnionDuesTaxItem(
  db: DatabaseWriter,
  taxYearId: number,
  personId: number,
  employerName: string,
) {
  const [item] = await db
    .insert(taxItems)
    .values({
      taxYearId,
      name: unionDuesTaxItemName(employerName),
      taxLineReference: "21200",
      type: "deduction_contribution",
      ownerKind: "person",
      personId,
      expectedAmountCents: null,
      actualAmountCents: 0,
      status: "in_progress",
      valueSource: "paycheques",
      taxTreatment: "professional_dues",
      notes: null,
    })
    .returning();
  return item!;
}

async function deleteTaxItemIfPresent(
  db: DatabaseWriter,
  taxItemId: number | null,
) {
  if (taxItemId === null) return;
  await db.delete(taxItems).where(eq(taxItems.id, taxItemId));
}

export async function reconcileEmploymentLinkedTaxItems(
  db: DatabaseWriter,
  employment: EmploymentRow,
  values: {
    employerName: string;
    personId: number;
    phspReportedOnT4: boolean;
    unionDuesReportedOnT4: boolean;
  },
) {
  let phspTaxItemId = employment.phspTaxItemId;
  let unionDuesTaxItemId = employment.unionDuesTaxItemId;

  if (values.phspReportedOnT4) {
    if (phspTaxItemId === null) {
      const item = await createPhspTaxItem(
        db,
        employment.taxYearId,
        values.employerName,
      );
      phspTaxItemId = item.id;
    } else {
      await db
        .update(taxItems)
        .set({ name: phspTaxItemName(values.employerName) })
        .where(eq(taxItems.id, phspTaxItemId));
    }
  } else if (phspTaxItemId !== null) {
    const taxItemId = phspTaxItemId;
    phspTaxItemId = null;
    await db
      .update(employments)
      .set({ phspTaxItemId: null })
      .where(eq(employments.id, employment.id));
    await deleteTaxItemIfPresent(db, taxItemId);
  }

  if (values.unionDuesReportedOnT4) {
    if (unionDuesTaxItemId === null) {
      const item = await createUnionDuesTaxItem(
        db,
        employment.taxYearId,
        values.personId,
        values.employerName,
      );
      unionDuesTaxItemId = item.id;
    } else {
      await db
        .update(taxItems)
        .set({
          name: unionDuesTaxItemName(values.employerName),
          personId: values.personId,
        })
        .where(eq(taxItems.id, unionDuesTaxItemId));
    }
  } else if (unionDuesTaxItemId !== null) {
    const taxItemId = unionDuesTaxItemId;
    unionDuesTaxItemId = null;
    await db
      .update(employments)
      .set({ unionDuesTaxItemId: null })
      .where(eq(employments.id, employment.id));
    await deleteTaxItemIfPresent(db, taxItemId);
  }

  if (
    phspTaxItemId !== employment.phspTaxItemId ||
    unionDuesTaxItemId !== employment.unionDuesTaxItemId
  ) {
    await db
      .update(employments)
      .set({ phspTaxItemId, unionDuesTaxItemId })
      .where(eq(employments.id, employment.id));
  }

  return { ...employment, phspTaxItemId, unionDuesTaxItemId };
}

export async function employmentProjection(
  db: DatabaseWriter,
  employmentId: number,
) {
  const [employment] = await db
    .select({
      taxItemId: employments.taxItemId,
      payFrequency: employments.payFrequency,
      status: employments.status,
      typicalGrossOverrideCents: employments.typicalGrossOverrideCents,
      year: taxYears.year,
    })
    .from(employments)
    .innerJoin(taxYears, eq(employments.taxYearId, taxYears.id))
    .where(eq(employments.id, employmentId));
  if (!employment) return null;

  const rows = await db
    .select({
      grossPayCents: paycheques.grossPayCents,
      payDate: paycheques.payDate,
    })
    .from(paycheques)
    .where(eq(paycheques.employmentId, employmentId))
    .orderBy(asc(paycheques.payDate), asc(paycheques.id));

  return {
    taxItemId: employment.taxItemId,
    ...calculateEmploymentProjection({
      year: employment.year,
      status: employment.status,
      payFrequency: employment.payFrequency,
      typicalGrossOverrideCents: employment.typicalGrossOverrideCents,
      grossPaysCents: rows.map((row) => row.grossPayCents),
      latestPayDate: rows.at(-1)?.payDate ?? null,
    }),
  };
}

async function sumLinkedPaychequeAmounts(
  db: DatabaseWriter,
  employmentId: number,
) {
  const rows = await db
    .select({
      extendedHealthCents: paycheques.extendedHealthCents,
      travelMedicalCents: paycheques.travelMedicalCents,
      unionDuesCents: paycheques.unionDuesCents,
    })
    .from(paycheques)
    .where(eq(paycheques.employmentId, employmentId));

  return rows.reduce(
    (totals, row) => ({
      phspCents:
        totals.phspCents + row.extendedHealthCents + row.travelMedicalCents,
      unionDuesCents: totals.unionDuesCents + row.unionDuesCents,
    }),
    { phspCents: 0, unionDuesCents: 0 },
  );
}

export async function syncEmploymentTaxItem(
  db: DatabaseWriter,
  employmentId: number,
) {
  const [employment] = await db
    .select()
    .from(employments)
    .where(eq(employments.id, employmentId));
  if (!employment) return;

  const projection = await employmentProjection(db, employmentId);
  if (projection) {
    await db
      .update(taxItems)
      .set({
        actualAmountCents: projection.actualGrossCents,
        expectedAmountCents: projection.projectedGrossCents,
      })
      .where(eq(taxItems.id, projection.taxItemId));
  }

  if (
    employment.phspTaxItemId === null &&
    employment.unionDuesTaxItemId === null
  ) {
    return;
  }

  const totals = await sumLinkedPaychequeAmounts(db, employmentId);

  if (employment.phspTaxItemId !== null) {
    await db
      .update(taxItems)
      .set({ actualAmountCents: totals.phspCents })
      .where(eq(taxItems.id, employment.phspTaxItemId));
  }

  if (employment.unionDuesTaxItemId !== null) {
    await db
      .update(taxItems)
      .set({ actualAmountCents: totals.unionDuesCents })
      .where(eq(taxItems.id, employment.unionDuesTaxItemId));
  }
}

export async function deleteEmploymentTaxItems(
  db: DatabaseWriter,
  employment: Pick<
    EmploymentRow,
    "taxItemId" | "phspTaxItemId" | "unionDuesTaxItemId"
  >,
) {
  await deleteTaxItemIfPresent(db, employment.phspTaxItemId);
  await deleteTaxItemIfPresent(db, employment.unionDuesTaxItemId);
  await deleteTaxItemIfPresent(db, employment.taxItemId);
}
