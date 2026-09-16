import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { databaseReady, db } from "~/server/db";
import {
  careItems,
  careOrganizations,
  carePlans,
  documents,
  people,
  providers,
  visits,
} from "~/server/db/schema";
import { documentPath, readDocument, writeDocument } from "~/server/documents/storage";

async function caller() {
  return createCaller(await createTRPCContext({ headers: new Headers() }));
}

async function createVisit() {
  const api = await caller();
  const person = await api.planning.createPerson({ displayName: "Test Person" });
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
    notes: null,
  });
}

async function attachDocument(visitId: string) {
  const id = crypto.randomUUID();
  const storageKey = `${crypto.randomUUID()}.pdf`;
  await writeDocument(storageKey, new TextEncoder().encode("%PDF-test"));
  await db.insert(documents).values({
    id,
    visitId,
    type: "receipt",
    title: "Visit receipt",
    originalFilename: "receipt.pdf",
    storageKey,
    mimeType: "application/pdf",
    sizeBytes: 9,
  });
  return { id, storageKey };
}

describe("documents router", () => {
  beforeEach(async () => {
    await databaseReady;
    await db.delete(documents);
    await db.delete(visits);
    await db.delete(providers);
    await db.delete(careOrganizations);
    await db.delete(careItems);
    await db.delete(carePlans);
    await db.delete(people);
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
    expect((await api.visits.detail({ id: visit.id }))?.visit.documentCount).toBe(1);

    await api.documents.update({ id: attached.id, title: "Paid receipt", type: "claim_record" });
    expect((await api.documents.overview())[0]).toMatchObject({
      title: "Paid receipt",
      type: "claim_record",
    });

    await api.documents.delete({ id: attached.id });
    expect(await db.select().from(documents).where(eq(documents.id, attached.id))).toEqual([]);
    await expect(readDocument(attached.storageKey)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("deletes managed document files with their visit", async () => {
    const api = await caller();
    const visit = await createVisit();
    const attached = await attachDocument(visit.id);

    await expect(api.visits.delete({ id: visit.id })).resolves.toMatchObject({ id: visit.id });
    expect(await db.select().from(documents).where(eq(documents.visitId, visit.id))).toEqual([]);
    await expect(readDocument(attached.storageKey)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("never resolves traversal outside the configured storage directory", () => {
    expect(() => documentPath("../receipt.pdf")).toThrow("Invalid document storage key");
  });
});
