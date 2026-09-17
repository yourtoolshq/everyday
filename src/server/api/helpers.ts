import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";

import type { db as database } from "~/server/db";
import { people, taxYears } from "~/server/db/schema";

export type Database = typeof database;

export async function requireHousehold(db: Database) {
  const household = await db.query.households.findFirst();
  if (!household) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Complete household setup first." });
  return household;
}

export async function requireActiveYear(db: Database, householdId: number) {
  const year = await db.query.taxYears.findFirst({
    where: (table, operators) => operators.and(
      operators.eq(table.householdId, householdId),
      operators.eq(table.isActive, true),
    ),
  });
  if (!year) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Choose an active tax year first." });
  return year;
}

export async function requireEditableActiveYear(db: Database, householdId: number) {
  const year = await requireActiveYear(db, householdId);
  if (year.status === "archived") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This tax year is archived. Change its lifecycle status before editing tracked data.",
    });
  }
  return year;
}

export async function getSettings(db: Database) {
  const household = await requireHousehold(db);
  const [householdPeople, years] = await Promise.all([
    db.select().from(people).where(eq(people.householdId, household.id)).orderBy(asc(people.sortOrder), asc(people.id)),
    db.select().from(taxYears).where(eq(taxYears.householdId, household.id)).orderBy(asc(taxYears.year)),
  ]);
  return { household, people: householdPeople, years };
}
