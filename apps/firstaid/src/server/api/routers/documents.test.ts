import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { dataPlatform } from "~/server/data";
import { db } from "~/server/db";
import { resetDatabase } from "~/server/db/reset";
import { documents } from "~/server/db/schema";

const pdfBytes = new TextEncoder().encode("%PDF-1.4\nTest document\n");

async function caller() {
  return createCaller(createTRPCContext({ headers: new Headers() }));
}

async function createVisit() {
  const api = await caller();
  const person = await api.planning.createPerson({
    displayName: "Test Person",
  });
  const organization = await api.careProviders.createOrganization({
    name: "Example Clinic",
    phoneNumbers: [],
    websiteUrl: null,
    bookingUrl: null,
  });
  return api.visits.create({
    personId: person.id,
    careItemId: null,
    providerId: null,
    careOrganizationId: organization.id,
    title: "Example visit",
    startsAt: "2027-04-01T14:30:00.000Z",
    status: "completed",
    costCents: null,
    notes: null,
  });
}

async function attachDocument(
  visitId: string,
  values: {
    type?: "receipt" | "claim_record";
    title?: string;
    claimId?: string;
  } = {},
) {
  const api = await caller();
  const staged = await dataPlatform.files.stage({
    endpoint: "document",
    originalFilename: "receipt.pdf",
    bytes: pdfBytes,
    type: { group: "pdf", mimeType: "application/pdf", extension: "pdf" },
  });
  return api.documents.create({
    visitId,
    file: staged.token,
    type: values.type ?? "receipt",
    title: values.title ?? "Visit receipt",
    claimId: values.claimId ?? null,
  });
}

describe("documents router", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("lists, updates, and deletes visit-owned document metadata", async () => {
    const api = await caller();
    const visit = await createVisit();
    const attached = await attachDocument(visit.id);

    const overview = await api.documents.overview();
    expect(overview).toMatchObject([
      {
        id: attached.id,
        title: "Visit receipt",
        type: "receipt",
        visitTitle: "Example visit",
        personName: "Test Person",
      },
    ]);
    expect(overview[0]).not.toHaveProperty("storageKey");
    expect(
      (await api.visits.detail({ id: visit.id }))?.visit.documentCount,
    ).toBe(1);

    const stored = await dataPlatform.files.read(attached.fileId);
    expect(Buffer.from(stored?.bytes ?? [])).toEqual(Buffer.from(pdfBytes));

    await api.documents.update({
      id: attached.id,
      title: "Paid receipt",
      type: "claim_record",
    });
    expect((await api.documents.overview())[0]).toMatchObject({
      title: "Paid receipt",
      type: "claim_record",
    });

    await api.documents.delete({ id: attached.id });
    expect(
      await db.select().from(documents).where(eq(documents.id, attached.id)),
    ).toEqual([]);
    expect(await dataPlatform.files.read(attached.fileId)).toBeNull();
  });

  it("deletes managed document files with their visit", async () => {
    const api = await caller();
    const visit = await createVisit();
    const attached = await attachDocument(visit.id);

    await expect(api.visits.delete({ id: visit.id })).resolves.toMatchObject({
      id: visit.id,
    });
    expect(
      await db.select().from(documents).where(eq(documents.visitId, visit.id)),
    ).toEqual([]);
    expect(await dataPlatform.files.read(attached.fileId)).toBeNull();
  });

  it("links claim paperwork to a visit claim", async () => {
    const api = await caller();
    const visit = await createVisit();
    const plan = await api.benefits.createPlan({
      name: "Plan",
      year: 2027,
      notes: null,
    });
    const benefit = await api.benefits.createBenefit({
      insurancePlanId: plan.id,
      name: "Massage therapy",
      coverageScope: "person",
      personId: visit.personId,
      annualLimitCents: 50000,
      openingUsedCents: 0,
      notes: null,
    });
    await api.visits.update({
      id: visit.id,
      personId: visit.personId,
      careItemId: visit.careItemId,
      providerId: visit.providerId,
      careOrganizationId: visit.careOrganizationId,
      title: visit.title,
      startsAt: visit.startsAt,
      status: visit.status,
      costCents: 11000,
      notes: visit.notes,
    });
    const claim = await api.visits.createClaim({
      visitId: visit.id,
      benefitId: benefit.id,
      status: "paid",
      amountCents: 10000,
      notes: null,
    });
    const attached = await attachDocument(visit.id, {
      type: "claim_record",
      title: "Claim confirmation",
      claimId: claim.id,
    });

    expect((await api.documents.overview())[0]).toMatchObject({
      id: attached.id,
      claimBenefitName: "Massage therapy",
    });

    await expect(
      api.documents.update({
        id: attached.id,
        title: "Claim confirmation",
        type: "receipt",
        claimId: claim.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
