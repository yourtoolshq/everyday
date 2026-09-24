import { access, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DetectedFileType } from "./detect";
import { createTestPlatform, pdfBytes } from "../test-platform";
import { parseFileToken } from "./router";
import { createFileCoordinator } from "./store";

const pdf: DetectedFileType = {
  group: "pdf",
  mimeType: "application/pdf",
  extension: "pdf",
};

let context: Awaited<ReturnType<typeof createTestPlatform>>;
const files = () => context.platform.files;

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

function stagePdf(endpoint = "statement") {
  return files().stage({
    endpoint,
    originalFilename: "Chequing March.pdf",
    bytes: pdfBytes,
    type: pdf,
  });
}

function stagedPath(token: string) {
  const parsed = parseFileToken(token);
  if (!parsed) throw new Error(`Invalid token ${token}`);
  return join(context.documentsDir, ".staging", parsed.id);
}

beforeEach(async () => {
  context = await createTestPlatform();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await context.cleanup();
});

describe("stage", () => {
  it("writes the bytes and metadata to staging", async () => {
    const staged = await stagePdf();

    expect(staged).toMatchObject({
      name: "Chequing March.pdf",
      size: pdfBytes.byteLength,
      mimeType: "application/pdf",
    });
    expect(staged.token).toMatch(/^statement:/);
    expect(await exists(stagedPath(staged.token))).toBe(true);
    expect(await exists(`${stagedPath(staged.token)}.json`)).toBe(true);
  });
});

describe("withFiles", () => {
  it("claims a staged file when the transaction commits", async () => {
    const staged = await stagePdf();

    const file = await files().withFiles(context.db, (_tx, tx) =>
      tx.claim(staged.token),
    );

    expect(file).toMatchObject({
      storageKey: `${file.id}.pdf`,
      originalFilename: "Chequing March.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdfBytes.byteLength,
      endpoint: "statement",
    });
    expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await files().get(file.id)).toEqual(file);
    expect(await readdir(join(context.documentsDir, ".staging"))).toEqual([]);

    const read = await files().read(file.id);
    expect(read?.bytes.equals(Buffer.from(pdfBytes))).toBe(true);
  });

  it("returns the file to staging when the transaction throws", async () => {
    const staged = await stagePdf();
    let claimedId = "";

    await expect(
      files().withFiles(context.db, async (_tx, tx) => {
        claimedId = (await tx.claim(staged.token)).id;
        throw new Error("domain insert failed");
      }),
    ).rejects.toThrow("domain insert failed");

    expect(await files().get(claimedId)).toBeNull();
    expect(await exists(join(context.documentsDir, `${claimedId}.pdf`))).toBe(
      false,
    );
    expect(await exists(stagedPath(staged.token))).toBe(true);

    const retried = await files().withFiles(context.db, (_tx, tx) =>
      tx.claim(staged.token),
    );
    expect(await files().read(retried.id)).not.toBeNull();
  });

  it("rejects a token that was already claimed", async () => {
    const staged = await stagePdf();
    await files().withFiles(context.db, (_tx, tx) => tx.claim(staged.token));

    await expect(
      files().withFiles(context.db, (_tx, tx) => tx.claim(staged.token)),
    ).rejects.toThrow("The uploaded file is no longer available");
  });

  it("rejects a token for a different endpoint", async () => {
    const staged = await stagePdf("statement");
    const { id } = parseFileToken(staged.token) ?? { id: "" };

    await expect(
      files().withFiles(context.db, (_tx, tx) => tx.claim(`voiceNote:${id}`)),
    ).rejects.toThrow("The uploaded file is no longer available");
  });

  it("rejects a malformed token", async () => {
    await expect(
      files().withFiles(context.db, (_tx, tx) => tx.claim("statement:../x")),
    ).rejects.toThrow("The uploaded file is no longer available");
  });

  it("removes a file when the transaction commits", async () => {
    const staged = await stagePdf();
    const file = await files().withFiles(context.db, (_tx, tx) =>
      tx.claim(staged.token),
    );

    await files().withFiles(context.db, (_tx, tx) => tx.remove(file.id));

    expect(await files().get(file.id)).toBeNull();
    expect(await exists(join(context.documentsDir, file.storageKey))).toBe(
      false,
    );
  });

  it("restores a removed file when the transaction throws", async () => {
    const staged = await stagePdf();
    const file = await files().withFiles(context.db, (_tx, tx) =>
      tx.claim(staged.token),
    );

    await expect(
      files().withFiles(context.db, async (_tx, tx) => {
        await tx.remove(file.id);
        throw new Error("domain delete failed");
      }),
    ).rejects.toThrow("domain delete failed");

    expect(await files().get(file.id)).toEqual(file);
    expect(await files().read(file.id)).not.toBeNull();
  });

  it("removes the row when the file is already missing on disk", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const staged = await stagePdf();
    const file = await files().withFiles(context.db, (_tx, tx) =>
      tx.claim(staged.token),
    );
    await rm(join(context.documentsDir, file.storageKey));

    await files().withFiles(context.db, (_tx, tx) => tx.remove(file.id));

    expect(await files().get(file.id)).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "removed file was already missing on disk",
      { fileId: file.id, storageKey: file.storageKey },
    );
  });
});

describe("read and stream", () => {
  it("return null for an unknown file", async () => {
    expect(await files().read("4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d")).toBe(
      null,
    );
    expect(await files().stream("4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d")).toBe(
      null,
    );
  });

  it("return null and warn when the file is missing on disk", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const staged = await stagePdf();
    const file = await files().withFiles(context.db, (_tx, tx) =>
      tx.claim(staged.token),
    );
    await rm(join(context.documentsDir, file.storageKey));

    expect(await files().stream(file.id)).toBeNull();
    expect(warn).toHaveBeenCalledWith("stored file missing on disk", {
      fileId: file.id,
      storageKey: file.storageKey,
    });
  });

  it("refuse a storage key outside the documents directory", async () => {
    const outside = join(context.dataDir, "outside.pdf");
    await writeFile(outside, pdfBytes);
    await context.db.run(
      `INSERT INTO yt_files (id, storage_key, original_filename, mime_type, size_bytes, endpoint)
       VALUES ('4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d', '../outside.pdf', 'outside.pdf', 'application/pdf', 1, 'statement')`,
    );

    await expect(
      files().read("4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d"),
    ).rejects.toThrow("Invalid storage key: ../outside.pdf");
  });
});

describe("createFileCoordinator", () => {
  it("defers discards until every hold is released", async () => {
    const coordinator = createFileCoordinator((work) => work());
    const path = join(context.documentsDir, "held.pdf");
    const file = { id: "held", storageKey: "held.pdf" };
    await writeFile(path, pdfBytes);

    const releaseFirst = coordinator.holdDeletes();
    const releaseSecond = coordinator.holdDeletes();
    await coordinator.discard(path, file);
    await releaseFirst();
    await releaseFirst();
    expect(await exists(path)).toBe(true);

    await releaseSecond();
    expect(await exists(path)).toBe(false);
  });
});
