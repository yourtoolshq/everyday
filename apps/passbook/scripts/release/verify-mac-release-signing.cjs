const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const PRODUCT_NAME = "Passbook";

/**
 * @typedef {{ status: number | null; stdout: string; stderr: string }} CommandResult
 * @typedef {(command: string, args: string[]) => CommandResult} CommandRunner
 */

/** @type {CommandRunner} */
const defaultCommandRunner = (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

/**
 * @param {string} releaseDir
 */
function findPackagedAppBundle(releaseDir) {
  const resolvedRoot = path.resolve(releaseDir);
  /** @type {string[]} */
  const queue = [resolvedRoot];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory() && entry.name === `${PRODUCT_NAME}.app`) {
        return fullPath;
      }
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        queue.push(fullPath);
      }
    }
  }
  throw new Error(
    `Could not find ${PRODUCT_NAME}.app under ${resolvedRoot}. Build the macOS package first.`,
  );
}

/**
 * @param {CommandResult} result
 */
function formatCommandFailure(command, args, result) {
  return `${command} ${args.join(" ")}\n${result.stderr}\n${result.stdout}`.trim();
}

/**
 * @param {string} appPath
 * @param {CommandRunner} runCommand
 */
function readCodesignDetails(appPath, runCommand = defaultCommandRunner) {
  const verify = runCommand("codesign", [
    "--verify",
    "--deep",
    "--strict",
    appPath,
  ]);
  if (verify.status !== 0) {
    throw new Error(
      `codesign verification failed: ${formatCommandFailure("codesign", ["--verify", "--deep", "--strict", appPath], verify)}`,
    );
  }

  const detailsResult = runCommand("codesign", ["-dv", "--verbose=4", appPath]);
  const details = `${detailsResult.stdout}\n${detailsResult.stderr}`.trim();
  if (!details) {
    throw new Error("codesign -dv produced no signature details.");
  }
  if (detailsResult.status !== 0 && !/Authority=/i.test(details)) {
    throw new Error(
      `codesign -dv failed: ${formatCommandFailure("codesign", ["-dv", "--verbose=4", appPath], detailsResult)}`,
    );
  }
  return details;
}

/**
 * @param {string} details
 */
function classifyDeveloperIdSignature(details) {
  if (/Signature=adhoc/i.test(details)) {
    return "adhoc";
  }
  if (/code object is not signed/i.test(details)) {
    return "unsigned";
  }
  if (/Authority=Developer ID Application:/i.test(details)) {
    return "developer-id";
  }
  return "other";
}

/**
 * @param {string} details
 */
function assertDeveloperIdApplication(details) {
  const classification = classifyDeveloperIdSignature(details);
  if (classification === "adhoc") {
    throw new Error(
      "Application is ad-hoc signed. Public Passbook updates require a Developer ID Application certificate.",
    );
  }
  if (classification === "unsigned") {
    throw new Error("Application bundle is not signed.");
  }
  if (classification !== "developer-id") {
    throw new Error(
      "Application is not signed with a Developer ID Application certificate.",
    );
  }
}

/**
 * @param {string} appPath
 * @param {CommandRunner} runCommand
 */
function assertStaplerValidates(appPath, runCommand = defaultCommandRunner) {
  if (process.platform !== "darwin") {
    return;
  }
  const result = runCommand("xcrun", ["stapler", "validate", appPath]);
  if (result.status !== 0) {
    throw new Error(
      `Notarization staple validation failed: ${formatCommandFailure("xcrun", ["stapler", "validate", appPath], result)}`,
    );
  }
}

/**
 * @param {{
 *   releaseDir: string;
 *   requireSigned?: boolean;
 *   runCommand?: CommandRunner;
 * }} options
 */
function verifyMacReleaseSigning({
  releaseDir,
  requireSigned = process.env.PASSBOOK_REQUIRE_SIGNED_RELEASE === "1",
  runCommand = defaultCommandRunner,
}) {
  if (!requireSigned) {
    return {
      skipped: true,
      reason: "PASSBOOK_REQUIRE_SIGNED_RELEASE is not set.",
    };
  }

  const appPath = findPackagedAppBundle(releaseDir);
  const details = readCodesignDetails(appPath, runCommand);
  assertDeveloperIdApplication(details);
  assertStaplerValidates(appPath, runCommand);
  return {
    skipped: false,
    appPath,
    classification: classifyDeveloperIdSignature(details),
  };
}

function parseCliArgs(argv) {
  /** @type {{ dir?: string }} */
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--dir") {
      options.dir = argv[index + 1];
      index += 1;
    }
  }
  return options;
}

if (require.main === module) {
  const options = parseCliArgs(process.argv.slice(2));
  if (!options.dir) {
    console.error(
      "Usage: node verify-mac-release-signing.cjs --dir <desktopReleaseDir>",
    );
    process.exit(1);
  }
  try {
    const result = verifyMacReleaseSigning({ releaseDir: options.dir });
    if (result.skipped) {
      console.log(`Skipped signing verification (${result.reason})`);
    } else {
      console.log(`Signed and notarized app validated: ${result.appPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  assertDeveloperIdApplication,
  classifyDeveloperIdSignature,
  findPackagedAppBundle,
  readCodesignDetails,
  verifyMacReleaseSigning,
};
