import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET } from "~/app/api/documents/[documentId]/file/route";
import { POST } from "~/app/api/visits/[visitId]/documents/route";
import { maxDocumentBytes } from "~/lib/documents";
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
import { removeDocument } from "~/server/documents/storage";

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
    costCents: null,
    notes: null,
  });
}

function uploadRequest(file: File, metadata = { title: "Receipt", type: "receipt" }) {
  const form = new FormData();
  form.set("file", file);
  form.set("title", metadata.title);
  form.set("type", metadata.type);
  return new Request("http://localhost/api/upload", { method: "POST", body: form });
}

describe("document upload and file routes", () => {
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

  afterEach(async () => {
    const storedDocuments = await db.select({ storageKey: documents.storageKey }).from(documents);
    await Promise.all(storedDocuments.map((document) => removeDocument(document.storageKey)));
    await db.delete(documents);
  });

  it("stores a detected file and serves it with private preview headers", async () => {
    const visit = await createVisit();
    const bytes = new TextEncoder().encode("%PDF-1.4\nTest document");
    const response = await POST(
      uploadRequest(new File([bytes], "../../receipt.pdf", { type: "text/plain" })),
      { params: Promise.resolve({ visitId: visit.id }) },
    );

    expect(response.status).toBe(201);
    const metadata = (await response.json()) as { id: string; mimeType: string; originalFilename: string };
    expect(metadata).toMatchObject({ mimeType: "application/pdf", originalFilename: "receipt.pdf" });
    expect(metadata).not.toHaveProperty("storageKey");

    const fileResponse = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ documentId: metadata.id }),
    });
    expect(fileResponse.status).toBe(200);
    expect(fileResponse.headers.get("content-type")).toBe("application/pdf");
    expect(fileResponse.headers.get("cache-control")).toBe("private, no-store");
    expect(fileResponse.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await fileResponse.arrayBuffer())).toEqual(bytes);
  });

  it("rejects empty, unsupported, oversized, and orphan uploads", async () => {
    const visit = await createVisit();
    const empty = await POST(uploadRequest(new File([], "empty.pdf")), {
      params: Promise.resolve({ visitId: visit.id }),
    });
    expect(empty.status).toBe(400);

    const unsupported = await POST(uploadRequest(new File(["plain text"], "notes.pdf")), {
      params: Promise.resolve({ visitId: visit.id }),
    });
    expect(unsupported.status).toBe(415);

    const oversized = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        headers: { "content-length": String(maxDocumentBytes + 1024 * 1024 + 1) },
      }),
      { params: Promise.resolve({ visitId: visit.id }) },
    );
    expect(oversized.status).toBe(413);

    const missingVisit = await POST(
      uploadRequest(new File(["%PDF-1.4"], "receipt.pdf")),
      { params: Promise.resolve({ visitId: crypto.randomUUID() }) },
    );
    expect(missingVisit.status).toBe(404);
  });
});
