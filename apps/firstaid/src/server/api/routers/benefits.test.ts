import { beforeEach, describe, expect, it } from "vitest";

import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { databaseReady, db } from "~/server/db";
import {
  benefits,
  careItems,
  careOrganizations,
  carePlans,
  claims,
  insurancePlans,
  people,
  providers,
  visits,
} from "~/server/db/schema";

async function caller() {
  return createCaller(await createTRPCContext({ headers: new Headers() }));
}

describe("benefits router", () => {
  beforeEach(async () => {
    await databaseReady;
    await db.delete(claims);
    await db.delete(visits);
    await db.delete(benefits);
    await db.delete(insurancePlans);
    await db.delete(providers);
    await db.delete(careOrganizations);
    await db.delete(careItems);
    await db.delete(carePlans);
    await db.delete(people);
  });

  it("creates plans and benefits with usage totals", async () => {
    const api = await caller();
    const person = await api.planning.createPerson({
      displayName: "Test Person",
    });
    const plan = await api.benefits.createPlan({
      name: "Employer plan",
      year: 2027,
      notes: null,
    });
    const benefit = await api.benefits.createBenefit({
      insurancePlanId: plan.id,
      name: "Massage therapy",
      coverageScope: "person",
      personId: person.id,
      annualLimitCents: 50000,
      openingUsedCents: 10000,
      notes: null,
    });

    const overview = await api.benefits.overview({ year: 2027 });
    expect(overview.plans).toHaveLength(1);
    expect(overview.plans[0]?.benefits[0]).toMatchObject({
      id: benefit.id,
      usedCents: 10000,
      remainingCents: 40000,
      pendingCents: 0,
    });
  });

  it("rejects invalid person scope combinations", async () => {
    const api = await caller();
    const plan = await api.benefits.createPlan({
      name: "Plan",
      year: 2027,
      notes: null,
    });

    await expect(
      api.benefits.createBenefit({
        insurancePlanId: plan.id,
        name: "Massage",
        coverageScope: "person",
        personId: null,
        annualLimitCents: 50000,
        openingUsedCents: 0,
        notes: null,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("prevents deleting benefits or plans referenced by claims", async () => {
    const api = await caller();
    const person = await api.planning.createPerson({
      displayName: "Test Person",
    });
    const plan = await api.benefits.createPlan({
      name: "Plan",
      year: 2027,
      notes: null,
    });
    const benefit = await api.benefits.createBenefit({
      insurancePlanId: plan.id,
      name: "Massage",
      coverageScope: "household",
      personId: null,
      annualLimitCents: 50000,
      openingUsedCents: 0,
      notes: null,
    });
    const organization = await api.careProviders.createOrganization({
      name: "Clinic",
      phoneNumbers: [],
      websiteUrl: null,
      bookingUrl: null,
    });
    const visit = await api.visits.create({
      personId: person.id,
      careItemId: null,
      providerId: null,
      careOrganizationId: organization.id,
      title: "Massage",
      startsAt: "2027-06-01T12:00:00.000Z",
      status: "completed",
      costCents: 11000,
      notes: null,
    });
    await api.visits.createClaim({
      visitId: visit.id,
      benefitId: benefit.id,
      status: "paid",
      amountCents: 10000,
      notes: null,
    });

    await expect(
      api.benefits.deleteBenefit({ id: benefit.id }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(
      api.benefits.deletePlan({ id: plan.id }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
