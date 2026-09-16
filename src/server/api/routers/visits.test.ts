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
  title: "Massage therapy",
  category: "therapy_wellness" as const,
  targetVisitCount: 2,
  cadence: "recurring_interval" as const,
  intervalCount: 3,
  intervalUnit: "months" as const,
  timingKind: "none" as const,
  targetDate: null,
  dateMeaning: null,
  targetMonth: null,
  targetSeason: null,
  source: "personal_decision" as const,
  sourceDetail: null,
  notes: null,
});

describe("visits and care providers", () => {
  beforeEach(async () => {
    await databaseReady;
    await db.delete(visits);
    await db.delete(providers);
    await db.delete(careOrganizations);
    await db.delete(careItems);
    await db.delete(carePlans);
    await db.delete(people);
  });

  it("derives multi-visit care goal progress from visit history", async () => {
    const api = await caller();
    const person = await api.planning.createPerson({ displayName: "Test Person" });
    const plan = await api.planning.createPlan({ year: 2027 });
    const item = await api.planning.createItem({ planId: plan.id, ...itemFields(person.id) });
    const organization = await api.careProviders.createOrganization({
      name: "Example Wellness Clinic",
      phoneNumbers: ["555-0100"],
      websiteUrl: null,
      bookingUrl: null,
    });
    const provider = await api.careProviders.createProvider({
      name: "Example Therapist",
      careOrganizationId: organization.id,
    });

    const firstVisit = await api.visits.create({
      personId: person.id,
      careItemId: item.id,
      providerId: provider.id,
      careOrganizationId: null,
      title: "Massage therapy",
      startsAt: "2027-03-10T15:00:00.000Z",
      status: "scheduled",
      notes: null,
    });
    expect(firstVisit.careOrganizationId).toBe(organization.id);
    expect((await api.planning.overview({ planId: plan.id })).items[0]).toMatchObject({
      progress: "in_progress",
      scheduledVisitCount: 1,
      completedVisitCount: 0,
    });

    await api.visits.setStatus({ id: firstVisit.id, status: "completed" });
    expect((await api.planning.overview({ planId: plan.id })).items[0]).toMatchObject({
      progress: "in_progress",
      completedVisitCount: 1,
    });

    await api.visits.create({
      personId: person.id,
      careItemId: item.id,
      providerId: null,
      careOrganizationId: organization.id,
      title: "Massage therapy",
      startsAt: "2027-06-10T15:00:00.000Z",
      status: "completed",
      notes: "Routine visit",
    });
    expect((await api.planning.overview({ planId: plan.id })).items[0]).toMatchObject({
      progress: "completed",
      completedVisitCount: 2,
    });
  });

  it("records an unplanned completed visit with an organization only", async () => {
    const api = await caller();
    const person = await api.planning.createPerson({ displayName: "Test Person" });
    const organization = await api.careProviders.createOrganization({
      name: "Example Lab",
      phoneNumbers: [],
      websiteUrl: null,
      bookingUrl: null,
    });
    const visit = await api.visits.create({
      personId: person.id,
      careItemId: null,
      providerId: null,
      careOrganizationId: organization.id,
      title: "Unplanned lab visit",
      startsAt: "2027-04-01T14:30:00.000Z",
      status: "completed",
      notes: null,
    });

    expect(visit).toMatchObject({ careItemId: null, providerId: null });
    await expect(api.careProviders.deleteOrganization({ id: organization.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("rejects linking a visit to another person’s care goal", async () => {
    const api = await caller();
    const first = await api.planning.createPerson({ displayName: "First Person" });
    const second = await api.planning.createPerson({ displayName: "Second Person" });
    const plan = await api.planning.createPlan({ year: 2027 });
    const item = await api.planning.createItem({ planId: plan.id, ...itemFields(first.id) });
    const organization = await api.careProviders.createOrganization({
      name: "Example Clinic",
      phoneNumbers: [],
      websiteUrl: null,
      bookingUrl: null,
    });

    await expect(
      api.visits.create({
        personId: second.id,
        careItemId: item.id,
        providerId: null,
        careOrganizationId: organization.id,
        title: "Invalid visit",
        startsAt: "2027-04-01T14:30:00.000Z",
        status: "scheduled",
        notes: null,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
