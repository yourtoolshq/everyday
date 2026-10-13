import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

import { defineDataPlatform } from "@yourtoolshq/data";

import * as schema from "~/server/db/schema";
import { attachDocument, saveProperty } from "./operations";
import * as repository from "./repository";

test("claims, replaces, and removes property photos transactionally; keeps policy files after deleting metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "roof-files-"));
  const platform = defineDataPlatform({
    app: "roof",
    dataDir: root,
    db: { schema, migrationsFolder: "drizzle" },
  });
  try {
    expect(await platform.settled()).toEqual({ state: "ready" });
    const ctx = { db: platform.db, files: platform.files };
    const stage = () =>
      platform.files.stage({
        endpoint: "propertyPhoto",
        originalFilename: "fictional.png",
        bytes: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG9sAAAAASUVORK5CYII=",
          "base64",
        ),
        type: { group: "image", mimeType: "image/png", extension: "png" },
      });
    const first = await stage();
    const property = await saveProperty(ctx, {
      name: "Example rental",
      relationship: "rental",
      stage: "current",
      photo: first.token,
    });
    const oldPhoto = property.photoFileId!;
    expect(await platform.files.get(oldPhoto)).toBeTruthy();
    const replacement = await stage();
    const updated = await saveProperty(
      ctx,
      {
        name: property.name,
        relationship: "rental",
        stage: "past",
        photo: replacement.token,
      },
      property.id,
    );
    expect(updated.photoFileId).not.toBe(oldPhoto);
    expect(await platform.files.get(oldPhoto)).toBeNull();
    await expect(
      saveProperty(
        ctx,
        {
          name: "Should roll back",
          relationship: "rental",
          stage: "past",
          photo: "propertyPhoto:00000000-0000-4000-8000-000000000000",
        },
        property.id,
      ),
    ).rejects.toThrow();
    expect((await repository.requireProperty(ctx.db, property.id)).name).toBe(
      property.name,
    );
    expect(await platform.files.get(updated.photoFileId!)).toBeTruthy();
    await saveProperty(
      ctx,
      {
        name: property.name,
        relationship: "rental",
        stage: "past",
        photo: null,
      },
      property.id,
    );
    expect(await platform.files.get(updated.photoFileId!)).toBeNull();
    const policy = await repository.saveInsurance(ctx.db, {
      propertyId: property.id,
      type: "tenant",
      provider: "Example insurer",
    });
    const file = await platform.files.stage({
      endpoint: "document",
      originalFilename: "policy.pdf",
      bytes: new TextEncoder().encode("%PDF-1.7\nfictional\n"),
      type: { group: "pdf", mimeType: "application/pdf", extension: "pdf" },
    });
    await attachDocument(ctx, {
      propertyId: property.id,
      insuranceId: policy.id,
      title: "Example policy",
      type: "insurance",
      file: file.token,
    });
    await repository.deleteInsurance(ctx.db, policy.id);
    const documents = await repository.listDocuments(ctx.db, property.id);
    expect(documents[0]?.insuranceId).toBeNull();
    expect(await platform.files.get(documents[0]!.fileId)).toBeTruthy();
  } finally {
    platform.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("lease files retain originals after deletion and reject cross-property links on attach and edit", async () => {
  const root = await mkdtemp(join(tmpdir(), "roof-leases-"));
  const platform = defineDataPlatform({
    app: "roof",
    dataDir: root,
    db: { schema, migrationsFolder: "drizzle" },
  });
  try {
    await platform.settled();
    const ctx = { db: platform.db, files: platform.files };
    const rental = await saveProperty(ctx, {
      name: "Maple rental",
      relationship: "rental",
      stage: "current",
    });
    const other = await saveProperty(ctx, {
      name: "Cedar rental",
      relationship: "rental",
      stage: "past",
    });
    const home = await saveProperty(ctx, {
      name: "Example home",
      relationship: "purchase",
      stage: "owned",
    });
    const input = {
      propertyId: rental.id,
      title: "Original lease",
      termType: "fixed_term" as const,
      startsOn: "2026-10-01",
      endsOn: "2027-09-30",
    };
    const lease = await repository.saveLease(ctx.db, input);
    await repository.saveLease(ctx.db, {
      ...input,
      title: "Renewal",
      startsOn: "2027-10-01",
      endsOn: "2028-09-30",
    });
    expect(await repository.listLeases(ctx.db, rental.id)).toHaveLength(2);
    await expect(
      repository.saveLease(ctx.db, { ...input, propertyId: home.id }),
    ).rejects.toThrow("rentals");
    await expect(
      repository.saveLease(
        ctx.db,
        { ...input, propertyId: other.id },
        lease.id,
      ),
    ).rejects.toThrow("this property");
    const bytes = new TextEncoder().encode(
      "From: example@example.invalid\nSubject: Lease confirmation\n\nFictional confirmation",
    );
    const file = await platform.files.stage({
      endpoint: "document",
      originalFilename: "confirmation.eml",
      bytes,
      type: { group: "eml", mimeType: "message/rfc822", extension: "eml" },
    });
    await expect(
      attachDocument(ctx, {
        propertyId: other.id,
        leaseId: lease.id,
        title: "Confirmation",
        type: "correspondence",
        file: file.token,
      }),
    ).rejects.toThrow("this property");
    const doc = await attachDocument(ctx, {
      propertyId: rental.id,
      leaseId: lease.id,
      title: "Confirmation",
      type: "correspondence",
      file: file.token,
    });
    const otherLease = await repository.saveLease(ctx.db, {
      ...input,
      propertyId: other.id,
    });
    await expect(
      repository.updateDocument(ctx.db, doc.id, {
        title: doc.title,
        type: doc.type,
        leaseId: otherLease.id,
      }),
    ).rejects.toThrow("this property");
    await repository.updateDocument(ctx.db, doc.id, {
      title: doc.title,
      type: doc.type,
      leaseId: null,
    });
    expect(
      (await repository.listDocuments(ctx.db, rental.id))[0]?.leaseId,
    ).toBeNull();
    await repository.updateDocument(ctx.db, doc.id, {
      title: doc.title,
      type: doc.type,
      leaseId: lease.id,
    });
    await repository.deleteLease(ctx.db, lease.id);
    expect(
      (await repository.listDocuments(ctx.db, rental.id))[0]?.leaseId,
    ).toBeNull();
    expect(await platform.files.get(doc.fileId)).toBeTruthy();
  } finally {
    platform.close();
    await rm(root, { recursive: true, force: true });
  }
});
