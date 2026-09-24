import { access } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { defineDataPlatform } from "./platform";
import { filesTable } from "./schema";
import { createTestPlatform } from "./test-platform";

let context: Awaited<ReturnType<typeof createTestPlatform>>;

function definePlatformAgain() {
  return defineDataPlatform({
    app: "test",
    dataDir: context.dataDir,
    db: {
      schema: { filesTable },
      migrationsFolder: context.migrationsFolder,
    },
  });
}

const fileRow = {
  id: "11111111-1111-4111-8111-111111111111",
  storageKey: "11111111-1111-4111-8111-111111111111.pdf",
  originalFilename: "Chequing March.pdf",
  mimeType: "application/pdf",
  sizeBytes: 19,
  endpoint: "statement",
};

beforeEach(async () => {
  context = await createTestPlatform();
});

afterEach(async () => {
  await context.cleanup();
});

describe("defineDataPlatform", () => {
  it("boots by creating the data layout and applying migrations", async () => {
    await access(join(context.dataDir, "test.db"));
    await access(context.documentsDir);

    await context.db.insert(filesTable).values(fileRow);
    expect(await context.db.select().from(filesTable)).toHaveLength(1);
  });

  it("shares one connection and boot per database file", async () => {
    const again = definePlatformAgain();

    expect(again.boot()).toBe(context.platform.boot());
    await context.db.insert(filesTable).values(fileRow);
    expect(await again.db.select().from(filesTable)).toHaveLength(1);
  });

  it("opens a fresh connection after close", async () => {
    await context.db.insert(filesTable).values(fileRow);
    context.platform.close();

    const reopened = definePlatformAgain();
    await reopened.boot();
    expect(await reopened.db.select().from(filesTable)).toHaveLength(1);
    context.platform = reopened;
  });
});
