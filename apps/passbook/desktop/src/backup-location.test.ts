import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { moveLegacyDesktopBackups } from "../electron/backup-location";

const testDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    testDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("moveLegacyDesktopBackups", () => {
  it("moves legacy archives beside desktop data", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "passbook-backups-"));
    testDirectories.push(root);
    const dataDir = path.join(root, "data");
    const legacyBackupDir = path.join(dataDir, "backups");
    const backupDir = path.join(root, "backups");
    await mkdir(legacyBackupDir, { recursive: true });
    await writeFile(path.join(legacyBackupDir, "existing.ytbackup"), "backup");

    moveLegacyDesktopBackups(dataDir, backupDir);

    await expect(
      readFile(path.join(backupDir, "existing.ytbackup"), "utf8"),
    ).resolves.toBe("backup");
  });

  it("leaves legacy archives alone when the new location already exists", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "passbook-backups-"));
    testDirectories.push(root);
    const dataDir = path.join(root, "data");
    const legacyBackupDir = path.join(dataDir, "backups");
    const backupDir = path.join(root, "backups");
    await mkdir(legacyBackupDir, { recursive: true });
    await mkdir(backupDir, { recursive: true });
    await writeFile(path.join(legacyBackupDir, "legacy.ytbackup"), "legacy");

    moveLegacyDesktopBackups(dataDir, backupDir);

    await expect(
      readFile(path.join(legacyBackupDir, "legacy.ytbackup"), "utf8"),
    ).resolves.toBe("legacy");
  });
});
