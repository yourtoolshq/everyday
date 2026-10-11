/** @typedef {{ url: string; sha512?: string; size?: number }} ReleaseFileEntry */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PASSBOOK_RELEASE_CHANNEL } = require("./version.cjs");
const { yaml } = require("./load-updater-yaml.cjs");

const CHANNEL_METADATA_FILE = `${PASSBOOK_RELEASE_CHANNEL}-mac.yml`;

/**
 * @param {string} name
 */
function isSafeArtifactFilename(name) {
  if (typeof name !== "string" || name.length === 0) {
    return false;
  }
  if (name !== path.basename(name)) {
    return false;
  }
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return false;
  }
  return true;
}

/**
 * @param {string | Buffer} input
 */
function computeSha512Base64(input) {
  const hash = crypto.createHash("sha512");
  hash.update(input);
  return hash.digest("base64");
}

/**
 * @param {string} packageVersion
 */
function expectedPassbookMacArtifacts(packageVersion) {
  const base = `Passbook-${packageVersion}-arm64`;
  return {
    channelMetadataFile: CHANNEL_METADATA_FILE,
    zip: `${base}.zip`,
    dmg: `${base}.dmg`,
    zipBlockmap: `${base}.zip.blockmap`,
    dmgBlockmap: `${base}.dmg.blockmap`,
  };
}

/**
 * @param {string} artifactsDir
 * @param {string} filename
 */
function readArtifactFile(artifactsDir, filename) {
  const absolutePath = path.join(artifactsDir, filename);
  const normalizedRoot = `${path.resolve(artifactsDir)}${path.sep}`;
  const resolved = path.resolve(absolutePath);
  if (!resolved.startsWith(normalizedRoot)) {
    throw new Error(`Artifact path escapes release directory: ${filename}`);
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`Missing release artifact: ${filename}`);
  }
  return fs.readFileSync(resolved);
}

/**
 * @param {ReleaseFileEntry} entry
 * @param {string} artifactsDir
 */
function validateReferencedFile(entry, artifactsDir) {
  const filename = entry.url;
  if (!isSafeArtifactFilename(filename)) {
    throw new Error(
      `Unsafe artifact filename in channel metadata: ${filename}`,
    );
  }
  if (
    typeof entry.size !== "number" ||
    !Number.isFinite(entry.size) ||
    entry.size <= 0
  ) {
    throw new Error(
      `Channel metadata missing valid size for ${filename}. Run sync-release-channel-metadata.cjs after packaging when sizes are absent.`,
    );
  }
  if (typeof entry.sha512 !== "string" || entry.sha512.length === 0) {
    throw new Error(`Channel metadata missing sha512 for ${filename}`);
  }
  const bytes = readArtifactFile(artifactsDir, filename);
  const actualSize = bytes.length;
  if (entry.size !== actualSize) {
    throw new Error(
      `Size mismatch for ${filename}: metadata ${entry.size}, actual ${actualSize}`,
    );
  }
  const actualSha512 = computeSha512Base64(bytes);
  if (entry.sha512 !== actualSha512) {
    throw new Error(`SHA512 mismatch for ${filename}`);
  }
}

/**
 * @param {{ artifactsDir: string; expectedPackageVersion: string }} options
 */
function validatePassbookReleaseArtifacts({
  artifactsDir,
  expectedPackageVersion,
}) {
  if (!expectedPackageVersion) {
    throw new Error("expectedPackageVersion is required.");
  }
  const resolvedDir = path.resolve(artifactsDir);
  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`Release artifacts directory not found: ${resolvedDir}`);
  }

  const expectedNames = expectedPassbookMacArtifacts(expectedPackageVersion);
  const metadataPath = path.join(
    resolvedDir,
    expectedNames.channelMetadataFile,
  );
  if (!fs.existsSync(metadataPath)) {
    throw new Error(
      `Missing channel metadata ${expectedNames.channelMetadataFile}. Set electron-builder publish channel to "${PASSBOOK_RELEASE_CHANNEL}".`,
    );
  }

  /** @type {{ version?: string; files?: ReleaseFileEntry[]; path?: string }} */
  let updateInfo;
  try {
    updateInfo = yaml.load(fs.readFileSync(metadataPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Cannot parse ${expectedNames.channelMetadataFile}: ${error.message}`,
    );
  }

  if (!updateInfo || typeof updateInfo !== "object") {
    throw new Error(
      `${expectedNames.channelMetadataFile} is empty or invalid.`,
    );
  }
  if (updateInfo.version !== expectedPackageVersion) {
    throw new Error(
      `Channel metadata version "${updateInfo.version ?? ""}" does not match expected "${expectedPackageVersion}".`,
    );
  }

  const files = updateInfo.files;
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error(`${expectedNames.channelMetadataFile} lists no files.`);
  }

  for (const entry of files) {
    if (!entry || typeof entry.url !== "string") {
      throw new Error("Channel metadata contains an invalid files entry.");
    }
    validateReferencedFile(entry, resolvedDir);
  }

  const referencedNames = new Set(files.map((entry) => entry.url));
  if (!referencedNames.has(expectedNames.zip)) {
    throw new Error(
      `${expectedNames.channelMetadataFile} must reference ${expectedNames.zip}.`,
    );
  }
  if (!referencedNames.has(expectedNames.dmg)) {
    throw new Error(
      `${expectedNames.channelMetadataFile} must reference ${expectedNames.dmg}.`,
    );
  }

  for (const requiredName of [
    expectedNames.zip,
    expectedNames.dmg,
    expectedNames.zipBlockmap,
    expectedNames.dmgBlockmap,
  ]) {
    readArtifactFile(resolvedDir, requiredName);
  }

  if (updateInfo.path != null) {
    if (!isSafeArtifactFilename(updateInfo.path)) {
      throw new Error(
        `Unsafe legacy path in channel metadata: ${updateInfo.path}`,
      );
    }
    const pathEntry = files.find((entry) => entry.url === updateInfo.path);
    if (!pathEntry) {
      throw new Error(
        `Legacy path "${updateInfo.path}" must match a files[].url entry.`,
      );
    }
    if (updateInfo.sha512 != null && updateInfo.sha512 !== pathEntry.sha512) {
      throw new Error(
        "Top-level sha512 must match the legacy path file entry.",
      );
    }
  }

  return {
    channelMetadataFile: expectedNames.channelMetadataFile,
    artifactNames: expectedNames,
    referencedFiles: [...referencedNames],
  };
}

function parseCliArgs(argv) {
  /** @type {{ dir?: string; packageVersion?: string }} */
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--dir") {
      options.dir = argv[index + 1];
      index += 1;
    } else if (token === "--package-version") {
      options.packageVersion = argv[index + 1];
      index += 1;
    }
  }
  return options;
}

if (require.main === module) {
  const options = parseCliArgs(process.argv.slice(2));
  if (!options.dir || !options.packageVersion) {
    console.error(
      "Usage: node validate-release-artifacts.cjs --dir <artifactsDir> --package-version <semver>",
    );
    process.exit(1);
  }
  try {
    validatePassbookReleaseArtifacts({
      artifactsDir: options.dir,
      expectedPackageVersion: options.packageVersion,
    });
    console.log(
      `Passbook release artifacts validated for ${options.packageVersion}.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  CHANNEL_METADATA_FILE,
  computeSha512Base64,
  expectedPassbookMacArtifacts,
  isSafeArtifactFilename,
  validatePassbookReleaseArtifacts,
};
