import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";

import type { Database } from "./helpers";
import type {
  TenureIntegrationEmployment,
  TenureIntegrationPaycheck,
} from "~/lib/tenure-client";
import { employmentDeductionSettings } from "~/domain/employment";
import {
  fetchTenureEmployments,
  fetchTenureHealth,
  fetchTenurePaychecks,
} from "~/lib/tenure-client";
import {
  employmentOverlapsTaxYear,
  mapTenureEmploymentInput,
  resolveTenurePersonId,
} from "~/lib/tenure-employment";
import {
  employments,
  households,
  paycheques,
  people,
  taxItems,
} from "~/server/db/schema";
import {
  reconcileEmploymentLinkedTaxItems,
  syncEmploymentTaxItem,
} from "./employment-values";

function paycheckBelongsToTaxYear(payDate: string, taxYear: number) {
  return Number(payDate.slice(0, 4)) === taxYear;
}

function mapTenurePaycheckValues(paycheck: TenureIntegrationPaycheck) {
  return {
    payDate: paycheck.payDate,
    grossPayCents: paycheck.grossPayCents,
    incomeTaxCents: paycheck.incomeTaxCents,
    federalIncomeTaxCents: paycheck.federalIncomeTaxCents,
    manitobaIncomeTaxCents: paycheck.manitobaIncomeTaxCents,
    cppCents: paycheck.cppCents,
    cpp2Cents: paycheck.cpp2Cents,
    eiCents: paycheck.eiCents,
    wiCents: paycheck.wiCents,
    ltdCents: paycheck.ltdCents,
    extendedHealthCents: paycheck.extendedHealthCents,
    travelMedicalCents: paycheck.travelMedicalCents,
    unionDuesCents: paycheck.unionDuesCents,
    otherDeductionsCents: paycheck.otherDeductionsCents,
    netPayCents: paycheck.netPayCents,
    tenurePaycheckId: paycheck.id,
    syncedFromTenure: true,
  };
}

export async function listTenureEmploymentLinks(db: Database, taxYear: number) {
  const [household] = await db.select().from(households).limit(1);
  if (!household) {
    return { tenureEmployments: [], localEmployments: [], householdPeople: [] };
  }

  const personMappings = household.tenurePersonMappings ?? {};

  const health = await fetchTenureHealth(household.tenureBaseUrl);
  const tenureEmployments = health.ok
    ? await fetchTenureEmployments(household.tenureBaseUrl).catch(() => [])
    : [];

  const householdPeople = await db
    .select()
    .from(people)
    .where(eq(people.householdId, household.id))
    .orderBy(asc(people.sortOrder), asc(people.id));

  const year = await db.query.taxYears.findFirst({
    where: (table, operators) =>
      operators.and(
        operators.eq(table.householdId, household.id),
        operators.eq(table.year, taxYear),
        operators.eq(table.isActive, true),
      ),
  });

  const localEmployments = year
    ? await db
        .select({
          id: employments.id,
          taxItemId: employments.taxItemId,
          employerName: employments.employerName,
          personId: employments.personId,
          personName: people.name,
          tenureEmploymentId: employments.tenureEmploymentId,
        })
        .from(employments)
        .innerJoin(people, eq(employments.personId, people.id))
        .where(eq(employments.taxYearId, year.id))
        .orderBy(asc(people.sortOrder), asc(employments.id))
    : [];

  const linksByTenureId = new Map(
    localEmployments
      .filter((employment) => employment.tenureEmploymentId)
      .map((employment) => [employment.tenureEmploymentId!, employment]),
  );

  return {
    tenureEmployments: tenureEmployments
      .filter((employment) => employmentOverlapsTaxYear(employment, taxYear))
      .map((employment) => {
        const linked = linksByTenureId.get(employment.id);
        const resolved = resolveTenurePersonId({
          tenurePersonId: employment.personId,
          tenurePersonName: employment.personName,
          householdPeople,
          personMappings,
        });
        return {
          id: employment.id,
          tenurePersonId: employment.personId,
          personName: employment.personName,
          employerName: employment.employerName,
          status: employment.status,
          startDate: employment.startDate,
          endDate: employment.endDate,
          payFrequency: employment.payFrequency,
          linkedEmploymentId: linked?.id ?? null,
          matchedPersonId: resolved.personId,
          personMatchKind: resolved.matchKind,
          canImport: Boolean(resolved.personId) && !linked,
        };
      }),
    localEmployments,
    householdPeople: householdPeople.map((person) => ({
      id: person.id,
      name: person.name,
    })),
  };
}

async function createTaxbookEmploymentFromTenure(
  db: Database,
  input: {
    taxYearId: number;
    taxYear: number;
    tenureEmployment: TenureIntegrationEmployment;
    personId: number;
  },
) {
  const values = mapTenureEmploymentInput(
    input.tenureEmployment,
    input.taxYear,
    input.personId,
  );

  return db.transaction(async (tx) => {
    const [taxItem] = await tx
      .insert(taxItems)
      .values({
        taxYearId: input.taxYearId,
        name: `Employment income — ${values.employerName}`,
        taxLineReference: "10100",
        type: "income",
        ownerKind: "person",
        personId: values.personId,
        expectedAmountCents: 0,
        actualAmountCents: 0,
        status: "in_progress",
        valueSource: "paycheques",
        taxTreatment: "employment_income",
        notes: null,
      })
      .returning();

    const [employment] = await tx
      .insert(employments)
      .values({
        taxYearId: input.taxYearId,
        taxItemId: taxItem!.id,
        tenureEmploymentId: input.tenureEmployment.id,
        ...employmentDeductionSettings(values),
      })
      .returning();

    const linked = await reconcileEmploymentLinkedTaxItems(tx, employment!, {
      employerName: values.employerName,
      personId: values.personId,
      phspReportedOnT4: values.phspReportedOnT4,
      unionDuesReportedOnT4: values.unionDuesReportedOnT4,
    });

    await syncEmploymentTaxItem(tx, linked.id);
    return linked;
  });
}

export async function setTenurePersonMapping(
  db: Database,
  input: { tenurePersonId: string; taxbookPersonId: number | null },
) {
  const household = await requireHouseholdForSync(db);
  const householdPeople = await db
    .select({ id: people.id })
    .from(people)
    .where(eq(people.householdId, household.id));

  const mappings = { ...(household.tenurePersonMappings ?? {}) };

  if (input.taxbookPersonId === null) {
    delete mappings[input.tenurePersonId];
  } else {
    const valid = householdPeople.some(
      (person) => person.id === input.taxbookPersonId,
    );
    if (!valid) {
      throw new Error("Choose a valid household member.");
    }
    mappings[input.tenurePersonId] = input.taxbookPersonId;
  }

  await db
    .update(households)
    .set({ tenurePersonMappings: mappings })
    .where(eq(households.id, household.id));

  return { success: true };
}

export async function importEmploymentsFromTenure(db: Database) {
  const household = await requireHouseholdForSync(db);
  const year = await requireActiveYearForSync(db, household.id);

  const links = await listTenureEmploymentLinks(db, year.year);
  const importable = links.tenureEmployments.filter(
    (employment) => employment.canImport && employment.matchedPersonId,
  );

  let createdCount = 0;
  const tenureById = new Map(
    (await fetchTenureEmployments(household.tenureBaseUrl)).map(
      (employment) => [employment.id, employment],
    ),
  );

  for (const item of importable) {
    const tenureEmployment = tenureById.get(item.id);
    if (!tenureEmployment || !item.matchedPersonId) continue;

    await createTaxbookEmploymentFromTenure(db, {
      taxYearId: year.id,
      taxYear: year.year,
      tenureEmployment,
      personId: item.matchedPersonId,
    });
    createdCount += 1;
  }

  const syncResult = await syncTenurePaycheques(db, { fullRefresh: true });

  return {
    createdCount,
    ...syncResult,
  };
}

async function requireHouseholdForSync(db: Database) {
  const [household] = await db.select().from(households).limit(1);
  if (!household) {
    throw new Error("Complete household setup first.");
  }
  return household;
}

async function requireActiveYearForSync(db: Database, householdId: number) {
  const year = await db.query.taxYears.findFirst({
    where: (table, operators) =>
      operators.and(
        operators.eq(table.householdId, householdId),
        operators.eq(table.isActive, true),
      ),
  });
  if (!year) {
    throw new Error("Choose an active tax year first.");
  }
  return year;
}

export async function reconcileEmploymentWithTenure(
  db: Database,
  employmentId: number,
) {
  const [employment] = await db
    .select({
      id: employments.id,
      tenureEmploymentId: employments.tenureEmploymentId,
      taxYearId: employments.taxYearId,
    })
    .from(employments)
    .where(eq(employments.id, employmentId));

  if (!employment?.tenureEmploymentId) {
    return { matchedCount: 0 };
  }

  const [household] = await db.select().from(households).limit(1);
  if (!household) return { matchedCount: 0 };

  const year = await db.query.taxYears.findFirst({
    where: (table, operators) => operators.eq(table.id, employment.taxYearId),
  });
  if (!year) return { matchedCount: 0 };

  const remotePaychecks = await fetchTenurePaychecks(household.tenureBaseUrl, {
    employmentId: employment.tenureEmploymentId,
  }).catch(() => []);

  const localPaycheques = await db
    .select()
    .from(paycheques)
    .where(
      and(
        eq(paycheques.employmentId, employment.id),
        eq(paycheques.syncedFromTenure, false),
      ),
    );

  let matchedCount = 0;
  for (const local of localPaycheques) {
    const remote = remotePaychecks.find(
      (item) =>
        item.payDate === local.payDate &&
        item.grossPayCents === local.grossPayCents &&
        paycheckBelongsToTaxYear(item.payDate, year.year),
    );
    if (!remote) continue;

    await db
      .update(paycheques)
      .set({
        tenurePaycheckId: remote.id,
        syncedFromTenure: true,
      })
      .where(eq(paycheques.id, local.id));
    matchedCount += 1;
  }

  return { matchedCount };
}

export async function syncTenurePaycheques(
  db: Database,
  input: { fullRefresh?: boolean } = {},
) {
  const household = await requireHouseholdForSync(db);

  const health = await fetchTenureHealth(household.tenureBaseUrl);
  if (!health.ok) {
    await db
      .update(households)
      .set({ tenureLastSyncError: health.error ?? "Unable to reach Tenure." })
      .where(eq(households.id, household.id));
    throw new Error(health.error ?? "Unable to reach Tenure.");
  }

  const linkedEmployments = await db
    .select({
      id: employments.id,
      tenureEmploymentId: employments.tenureEmploymentId,
      taxYearId: employments.taxYearId,
    })
    .from(employments)
    .where(isNotNull(employments.tenureEmploymentId));

  const syncedAt = new Date().toISOString();
  let upsertedCount = 0;
  let deletedCount = 0;

  for (const employment of linkedEmployments) {
    if (!employment.tenureEmploymentId) continue;

    const year = await db.query.taxYears.findFirst({
      where: (table, operators) => operators.eq(table.id, employment.taxYearId),
    });
    if (!year) continue;

    const fullRefresh = input.fullRefresh ?? !household.tenureLastSyncAt;
    const remotePaychecks = await fetchTenurePaychecks(
      household.tenureBaseUrl,
      {
        employmentId: employment.tenureEmploymentId,
        updatedSince: fullRefresh
          ? undefined
          : (household.tenureLastSyncAt ?? undefined),
      },
    );

    const yearPaychecks = remotePaychecks.filter((paycheck) =>
      paycheckBelongsToTaxYear(paycheck.payDate, year.year),
    );

    await db.transaction(async (tx) => {
      for (const remote of yearPaychecks) {
        const values = mapTenurePaycheckValues(remote);
        const [existing] = await tx
          .select({ id: paycheques.id })
          .from(paycheques)
          .where(eq(paycheques.tenurePaycheckId, remote.id));

        if (existing) {
          await tx
            .update(paycheques)
            .set(values)
            .where(eq(paycheques.id, existing.id));
        } else {
          await tx.insert(paycheques).values({
            employmentId: employment.id,
            ...values,
          });
        }
        upsertedCount += 1;
      }

      if (fullRefresh) {
        const remoteIds = new Set(yearPaychecks.map((paycheck) => paycheck.id));
        const localSynced = await tx
          .select({
            id: paycheques.id,
            tenurePaycheckId: paycheques.tenurePaycheckId,
          })
          .from(paycheques)
          .where(
            and(
              eq(paycheques.employmentId, employment.id),
              eq(paycheques.syncedFromTenure, true),
            ),
          );

        const staleIds = localSynced
          .filter(
            (row) =>
              row.tenurePaycheckId && !remoteIds.has(row.tenurePaycheckId),
          )
          .map((row) => row.id);

        if (staleIds.length > 0) {
          await tx.delete(paycheques).where(inArray(paycheques.id, staleIds));
          deletedCount += staleIds.length;
        }
      }

      await syncEmploymentTaxItem(tx, employment.id);
    });
  }

  await db
    .update(households)
    .set({
      tenureLastSyncAt: syncedAt,
      tenureLastSyncError: null,
    })
    .where(eq(households.id, household.id));

  return {
    syncedAt,
    upsertedCount,
    deletedCount,
    linkedEmploymentCount: linkedEmployments.length,
  };
}
