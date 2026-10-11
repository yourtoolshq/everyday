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
