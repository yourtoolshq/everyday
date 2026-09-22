import { beforeEach, describe, expect, it } from "vitest";

import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { databaseReady, db } from "~/server/db";
import {
  careItems,
  careOrganizations,
  carePlans,
  people,
  providers,
  visits,
} from "~/server/db/schema";

async function caller() {
  return createCaller(await createTRPCContext({ headers: new Headers() }));
}

const itemFields = (personId: string) => ({
  personId,
  title: "Dental cleaning",
  category: "dental" as const,
  targetVisitCount: 1,
  cadence: "yearly" as const,
  intervalCount: null,
  intervalUnit: null,
  timingKind: "month" as const,
  targetDate: null,
  dateMeaning: null,
  targetMonth: 6,
  targetSeason: null,
  source: "preventive_care" as const,
  sourceDetail: "Household routine",
  notes: null,
});

describe("planning router", () => {
  beforeEach(async () => {
    await databaseReady;
    await db.delete(visits);
    await db.delete(providers);
    await db.delete(careOrganizations);
    await db.delete(careItems);
    await db.delete(carePlans);
    await db.delete(people);
  });

  it("creates a household year and manages its care items", async () => {
    const api = await caller();
    const person = await api.planning.createPerson({
      displayName: "Test Person",
    });
    const plan = await api.planning.createPlan({ year: 2027 });
    const item = await api.planning.createItem({
      planId: plan.id,
      ...itemFields(person.id),
    });

    await api.planning.setItemPursuit({ id: item.id, notPursuing: true });
    const overview = await api.planning.overview({ planId: plan.id });

    expect(overview.selectedPlan?.year).toBe(2027);
    expect(overview.people).toMatchObject([
      { displayName: "Test Person", careItemCount: 1 },
    ]);
    expect(overview.items).toMatchObject([
      {
        title: "Dental cleaning",
        progress: "not_pursuing",
        targetVisitCount: 1,
      },
    ]);

    await api.planning.updateItem({
      id: item.id,
      ...itemFields(person.id),
      title: "Dental exam and cleaning",
    });
    await api.planning.deleteItem({ id: item.id });
    expect((await api.planning.overview({ planId: plan.id })).items).toEqual(
      [],
    );
  });

  it("enforces one household plan per year", async () => {
    const api = await caller();
    await api.planning.createPlan({ year: 2027 });
    await expect(api.planning.createPlan({ year: 2027 })).rejects.toMatchObject(
      { code: "CONFLICT" },
    );
  });

  it("prevents deleting a person with care items and cascades plan deletion", async () => {
    const api = await caller();
    const person = await api.planning.createPerson({
      displayName: "Test Person",
    });
    const plan = await api.planning.createPlan({ year: 2027 });
    await api.planning.createItem({
      planId: plan.id,
      ...itemFields(person.id),
    });

    await expect(
      api.planning.deletePerson({ id: person.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await api.planning.deletePlan({ id: plan.id });
    await expect(
      api.planning.deletePerson({ id: person.id }),
    ).resolves.toMatchObject({ id: person.id });
  });

  it("rejects incomplete recurring and dated care items", async () => {
    const api = await caller();
    const person = await api.planning.createPerson({
      displayName: "Test Person",
    });
    const plan = await api.planning.createPlan({ year: 2027 });

    await expect(
      api.planning.createItem({
        planId: plan.id,
        ...itemFields(person.id),
        cadence: "recurring_interval",
        intervalCount: null,
        intervalUnit: null,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      api.planning.createItem({
        planId: plan.id,
        ...itemFields(person.id),
        timingKind: "date",
        targetDate: "2027-03-01",
        dateMeaning: null,
        targetMonth: null,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
