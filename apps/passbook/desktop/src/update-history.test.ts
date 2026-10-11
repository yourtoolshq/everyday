import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  appendUpdateHistory,
  getUpdateHistoryPath,
} from "../electron/update-history.js";

describe("appendUpdateHistory", () => {
  let dataDir: string;

  afterEach(async () => {
    if (dataDir) {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it("writes JSON lines outside the update intent directory", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "passbook-update-history-"));
    await appendUpdateHistory(dataDir, {
      event: "install",
      stage: "native_stage",
      currentVersion: "0.1.0",
      targetVersion: "0.1.1",
      result: "failed",
      error: "Native update staging timed out.",
    });

    const raw = await readFile(getUpdateHistoryPath(dataDir), "utf8");
    const line = JSON.parse(raw.trim()) as {
      event: string;
      stage: string;
      error: string;
    };
    expect(line.event).toBe("install");
    expect(line.stage).toBe("native_stage");
    expect(line.error).toContain("staging timed out");
    expect(getUpdateHistoryPath(dataDir)).not.toContain(".update/");
  });

  it("keeps only the most recent bounded history", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "passbook-update-history-"));
    const path = getUpdateHistoryPath(dataDir);
    const bigLine = `${"x".repeat(500)}\n`;
    await writeFile(path, bigLine.repeat(120), "utf8");

    await appendUpdateHistory(dataDir, {
      event: "install",
      stage: "native_stage",
      result: "ok",
    });

    const raw = await readFile(path, "utf8");
    expect(raw.length).toBeLessThanOrEqual(33_000);
    const lastLine = raw.trim().split("\n").at(-1);
    expect(JSON.parse(lastLine ?? "{}")).toMatchObject({
      event: "install",
      stage: "native_stage",
      result: "ok",
    });
  });
});
