#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function setDesktopVersion(repoRoot, version) {
  if (!/^\d+\.\d+\.\d+\.\d{8}\.\d+$/.test(version)) {
    throw new Error(`Invalid Passbook release version '${version}'.`);
  }

  const packageJsonPath = path.join(
    repoRoot,
    "apps/passbook/desktop/package.json",
  );
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  packageJson.version = version;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function main() {
  const version = process.argv[2];
  const repoRoot = process.argv[3] ?? process.cwd();
  if (!version) {
    throw new Error("Usage: set-desktop-version.cjs <version> [repo-root]");
  }
  setDesktopVersion(repoRoot, version);
}

if (require.main === module) {
  main();
}

module.exports = {
  setDesktopVersion,
};
