import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  computeSha512Base64,
  expectedPassbookMacArtifacts,
  validatePassbookReleaseArtifacts,
} from "./validate-release-artifacts.cjs";
import { PASSBOOK_RELEASE_CHANNEL } from "./version.cjs";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));
const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempArtifactsDir() {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "passbook-release-artifacts-"),
  );
  tempDirs.push(dir);
  return dir;
}

function writeBuilderShapedFixture(
  dir,
  packageVersion,
  {
    corruptZip = false,
    omitDmgFile = false,
    omitDmgReference = false,
    traversal = false,
  } = {},
) {
  const names = expectedPassbookMacArtifacts(packageVersion);
  const zipBytes = Buffer.from("zip-bytes");
  const zipOnDisk = corruptZip ? Buffer.from("wrong") : zipBytes;
  const dmgBytes = Buffer.from("dmg-bytes");
  const zipSha512 = computeSha512Base64(zipBytes);
  const dmgSha512 = computeSha512Base64(dmgBytes);

  fs.writeFileSync(path.join(dir, names.zip), zipOnDisk);
  if (!omitDmgFile) {
    fs.writeFileSync(path.join(dir, names.dmg), dmgBytes);
  }
  fs.writeFileSync(
    path.join(dir, names.zipBlockmap),
    Buffer.from("zip-blockmap"),
  );
  fs.writeFileSync(
    path.join(dir, names.dmgBlockmap),
    Buffer.from("dmg-blockmap"),
  );

  const zipUrl = traversal ? "../evil.zip" : names.zip;
  const files = [
    `  - url: ${zipUrl}`,
    `    sha512: ${zipSha512}`,
    `    size: ${zipOnDisk.length}`,
  ];
  if (!omitDmgReference) {
    files.push(
      `  - url: ${names.dmg}`,
      `    sha512: ${dmgSha512}`,
      `    size: ${dmgBytes.length}`,
    );
  }

  fs.writeFileSync(
    path.join(dir, `${PASSBOOK_RELEASE_CHANNEL}-mac.yml`),
    [
      `version: ${packageVersion}`,
      "files:",
      ...files,
      `path: ${names.zip}`,
      `sha512: ${zipSha512}`,
      'releaseDate: "2026-01-01T00:00:00.000Z"',
      "",
    ].join("\n"),
  );
}

describe("validatePassbookReleaseArtifacts", () => {
  const packageVersion = "0.2.0-passbook.20260101.1";

  it("accepts electron-builder-shaped metadata with zip and dmg entries", () => {
    const dir = makeTempArtifactsDir();
    writeBuilderShapedFixture(dir, packageVersion);
    expect(
      validatePassbookReleaseArtifacts({
        artifactsDir: dir,
        expectedPackageVersion: packageVersion,
      }).referencedFiles,
    ).toEqual(
      expect.arrayContaining([
        `Passbook-${packageVersion}-arm64.zip`,
        `Passbook-${packageVersion}-arm64.dmg`,
      ]),
    );
  });

  it("matches the checked-in builder sample fixture shape", () => {
    const dir = makeTempArtifactsDir();
    writeBuilderShapedFixture(dir, packageVersion);
    const sample = fs.readFileSync(
      path.join(
        fixtureDir,
        "fixtures/electron-builder-passbook-mac.sample.yml",
      ),
      "utf8",
    );
    expect(sample).toContain(
      "path: Passbook-0.2.0-passbook.20260101.1-arm64.zip",
    );
    expect(sample).toMatch(/url: Passbook-.*-arm64\.dmg/);
  });

  it("rejects version mismatches", () => {
    const dir = makeTempArtifactsDir();
    writeBuilderShapedFixture(dir, packageVersion);
    expect(() =>
      validatePassbookReleaseArtifacts({
        artifactsDir: dir,
        expectedPackageVersion: "0.2.0-passbook.20260101.2",
      }),
    ).toThrow(/does not match expected/);
  });

  it("rejects missing required dmg artifact files", () => {
    const dir = makeTempArtifactsDir();
    writeBuilderShapedFixture(dir, packageVersion, { omitDmgFile: true });
    expect(() =>
      validatePassbookReleaseArtifacts({
        artifactsDir: dir,
        expectedPackageVersion: packageVersion,
      }),
    ).toThrow(/Missing release artifact/);
  });

  it("rejects metadata that omits dmg from files", () => {
    const dir = makeTempArtifactsDir();
    writeBuilderShapedFixture(dir, packageVersion, { omitDmgReference: true });
    expect(() =>
      validatePassbookReleaseArtifacts({
        artifactsDir: dir,
        expectedPackageVersion: packageVersion,
      }),
    ).toThrow(/must reference .*\.dmg/);
  });

  it("rejects corrupt checksums", () => {
    const dir = makeTempArtifactsDir();
    writeBuilderShapedFixture(dir, packageVersion, { corruptZip: true });
    expect(() =>
      validatePassbookReleaseArtifacts({
        artifactsDir: dir,
        expectedPackageVersion: packageVersion,
      }),
    ).toThrow(/Size mismatch|SHA512 mismatch/);
  });

  it("rejects traversal filenames in metadata", () => {
    const dir = makeTempArtifactsDir();
    writeBuilderShapedFixture(dir, packageVersion, { traversal: true });
    expect(() =>
      validatePassbookReleaseArtifacts({
        artifactsDir: dir,
        expectedPackageVersion: packageVersion,
      }),
    ).toThrow(/Unsafe artifact filename/);
  });
});
