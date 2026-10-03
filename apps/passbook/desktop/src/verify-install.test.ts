import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { verifyElectronInstall } from "../electron/verify-install";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeElectronFixture(options: {
  pathTxt?: string;
  includeBinary?: boolean;
}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "passbook-electron-"));
  tempDirs.push(root);
  const distDir = path.join(root, "dist", "Electron.app", "Contents", "MacOS");
  fs.mkdirSync(distDir, { recursive: true });

  if (options.includeBinary) {
    fs.writeFileSync(path.join(distDir, "Electron"), "");
  }
  if (options.pathTxt !== undefined) {
    fs.writeFileSync(path.join(root, "path.txt"), options.pathTxt);
  }

  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "electron", version: "0.0.0-test" }),
  );

  const resolve = (id: string) => {
    if (id === "electron/package.json") {
      return path.join(root, "package.json");
    }
    throw new Error(`Unexpected require: ${id}`);
  };
  const requireFrom = Object.assign(resolve, { resolve }) as NodeRequire;

  return { root, requireFrom };
}

describe("verifyElectronInstall", () => {
  it("accepts a complete Electron install", () => {
    const { root, requireFrom } = makeElectronFixture({
      pathTxt: "Electron.app/Contents/MacOS/Electron",
      includeBinary: true,
    });

    expect(verifyElectronInstall(requireFrom)).toEqual({
      ok: true,
      electronDir: root,
    });
  });

  it("rejects a missing path.txt marker", () => {
    const { root, requireFrom } = makeElectronFixture({
      includeBinary: true,
    });

    const result = verifyElectronInstall(requireFrom);
    expect(result.ok).toBe(false);
    expect(result.electronDir).toBe(root);
    expect(result.message).toContain("path.txt is missing");
  });

  it("rejects a missing Electron binary", () => {
    const { root, requireFrom } = makeElectronFixture({
      pathTxt: "Electron.app/Contents/MacOS/Electron",
    });

    const result = verifyElectronInstall(requireFrom);
    expect(result.ok).toBe(false);
    expect(result.electronDir).toBe(root);
    expect(result.message).toContain("Electron binary is missing");
  });
});
