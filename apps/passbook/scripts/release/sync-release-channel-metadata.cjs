/**
 * electron-builder 25.x emits sha512 for mac artifacts but usually omits file sizes.
 * Stamp sizes from disk into passbook-mac.yml before contract validation.
 */

const fs = require("node:fs");
const path = require("node:path");

const { PASSBOOK_RELEASE_CHANNEL } = require("./version.cjs");
const { yaml } = require("./load-updater-yaml.cjs");
const { isSafeArtifactFilename } = require("./validate-release-artifacts.cjs");

const CHANNEL_METADATA_FILE = `${PASSBOOK_RELEASE_CHANNEL}-mac.yml`;

/**
 * @param {string} artifactsDir
 */
function syncReleaseChannelMetadata(artifactsDir) {
  const resolvedDir = path.resolve(artifactsDir);
  const metadataPath = path.join(resolvedDir, CHANNEL_METADATA_FILE);
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Missing ${CHANNEL_METADATA_FILE} in ${resolvedDir}`);
  }

  /** @type {{ files?: { url: string; size?: number }[]; path?: string }} */
  const updateInfo = yaml.load(fs.readFileSync(metadataPath, "utf8"));
  if (!updateInfo?.files?.length) {
    throw new Error(`${CHANNEL_METADATA_FILE} has no files entries to sync.`);
  }

  for (const entry of updateInfo.files) {
    if (!entry?.url || !isSafeArtifactFilename(entry.url)) {
      throw new Error("Invalid files entry in channel metadata.");
    }
    const filePath = path.join(resolvedDir, entry.url);
    const { size } = fs.statSync(filePath);
    entry.size = size;
  }

  if (updateInfo.path != null) {
    const pathEntry = updateInfo.files.find(
      (entry) => entry.url === updateInfo.path,
    );
    if (pathEntry?.size != null) {
      updateInfo.size = pathEntry.size;
    }
  }

  fs.writeFileSync(metadataPath, yaml.dump(updateInfo), "utf8");
  return { metadataPath, fileCount: updateInfo.files.length };
}

function parseCliArgs(argv) {
  /** @type {{ dir?: string }} */
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--dir") {
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
      "Usage: node sync-release-channel-metadata.cjs --dir <artifactsDir>",
    );
    process.exit(1);
  }
  try {
    const result = syncReleaseChannelMetadata(options.dir);
    console.log(
      `Synced sizes for ${result.fileCount} entries in ${result.metadataPath}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = { syncReleaseChannelMetadata };
