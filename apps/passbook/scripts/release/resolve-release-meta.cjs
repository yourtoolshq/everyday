#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const { resolvePassbookReleaseMetadata } = require("./version.cjs");

function readDesktopPackageVersion(repoRoot) {
  const packageJsonPath = path.join(
    repoRoot,
    "apps/passbook/desktop/package.json",
  );
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  if (!packageJson.version) {
    throw new Error(`Missing version in ${packageJsonPath}`);
  }
  return packageJson.version;
}

function appendGithubOutput(outputPath, entries) {
  fs.appendFileSync(
    outputPath,
    entries.map(([key, value]) => `${key}=${value}\n`).join(""),
  );
}

function main() {
  const args = process.argv.slice(2);
  const readArg = (flag) => {
    const index = args.indexOf(flag);
    if (index === -1 || index === args.length - 1) {
      throw new Error(`Missing required argument ${flag}`);
    }
    return args[index + 1];
  };

  const date = readArg("--date");
  const runNumber = Number(readArg("--run-number"));
  const sha = readArg("--sha");
  const repoRoot = readArg("--repo-root");
  const githubOutput = args.includes("--github-output")
    ? process.env.GITHUB_OUTPUT
    : undefined;

  if (!/^\d{8}$/.test(date)) {
    throw new Error(`Invalid release date '${date}'.`);
  }
  if (!Number.isInteger(runNumber) || runNumber < 1) {
    throw new Error(`Invalid run number '${runNumber}'.`);
  }
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
    throw new Error(`Invalid commit sha '${sha}'.`);
  }

  const metadata = resolvePassbookReleaseMetadata({
    packageVersion: readDesktopPackageVersion(repoRoot),
    date,
    runNumber,
    sha,
  });

  const entries = [
    ["base_version", metadata.baseVersion],
    ["version", metadata.version],
    ["tag", metadata.tag],
    ["name", metadata.name],
    ["short_sha", metadata.shortSha],
  ];

  if (githubOutput) {
    appendGithubOutput(githubOutput, entries);
    return;
  }

  for (const [key, value] of entries) {
    console.log(`${key}=${value}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  readDesktopPackageVersion,
};
