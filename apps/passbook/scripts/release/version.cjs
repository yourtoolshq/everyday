/** @typedef {{ major: number; minor: number; patch: number; date: number; runNumber: number }} PassbookReleaseVersion */

const PASSBOOK_RELEASE_TAG_PREFIX = "passbook-v";
const MINIMUM_RELEASE_GAP_MS = 6 * 60 * 60 * 1000;

function parsePassbookReleaseTag(tag) {
  const match = /^passbook-v(\d+)\.(\d+)\.(\d+)\.(\d{8})\.(\d+)$/.exec(tag);
  if (!match) return undefined;
  const [, major, minor, patch, date, runNumber] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    date: Number(date),
    runNumber: Number(runNumber),
  };
}

function isPassbookReleaseTag(tag) {
  return parsePassbookReleaseTag(tag) !== undefined;
}

function resolveTargetBaseVersion(packageVersion) {
  const stableCore = packageVersion.replace(/[-+].*$/, "");
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(stableCore);
  if (!match) {
    throw new Error(`Invalid desktop package version '${packageVersion}'.`);
  }
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

function resolvePassbookReleaseMetadata({
  packageVersion,
  date,
  runNumber,
  sha,
}) {
  const baseVersion = resolveTargetBaseVersion(packageVersion);
  const version = `${baseVersion}.${date}.${runNumber}`;
  const shortSha = sha.slice(0, 12);
  return {
    baseVersion,
    version,
    tag: `${PASSBOOK_RELEASE_TAG_PREFIX}${version}`,
    name: `Passbook ${version} (${shortSha})`,
    shortSha,
  };
}

function comparePassbookReleaseVersions(left, right) {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch !== right.patch) return left.patch - right.patch;
  if (left.date !== right.date) return left.date - right.date;
  return left.runNumber - right.runNumber;
}

function resolvePreviousPassbookTag(tags, currentTag) {
  const current = parsePassbookReleaseTag(currentTag);
  if (!current) {
    throw new Error(`Invalid Passbook release tag '${currentTag}'.`);
  }

  const candidates = tags
    .map((tag) => ({ tag, parsed: parsePassbookReleaseTag(tag) }))
    .filter((entry) => entry.parsed !== undefined)
    .filter(
      (entry) => comparePassbookReleaseVersions(entry.parsed, current) < 0,
    )
    .sort((left, right) =>
      comparePassbookReleaseVersions(right.parsed, left.parsed),
    );

  return candidates[0]?.tag;
}

function shouldScheduledRelease({
  lastPublishedAt,
  now,
  comparisonStatus,
  minimumGapMs = MINIMUM_RELEASE_GAP_MS,
}) {
  if (!lastPublishedAt) return true;
  if (now - lastPublishedAt < minimumGapMs) return false;
  return comparisonStatus === "ahead";
}

module.exports = {
  PASSBOOK_RELEASE_TAG_PREFIX,
  MINIMUM_RELEASE_GAP_MS,
  comparePassbookReleaseVersions,
  isPassbookReleaseTag,
  parsePassbookReleaseTag,
  resolvePassbookReleaseMetadata,
  resolvePreviousPassbookTag,
  resolveTargetBaseVersion,
  shouldScheduledRelease,
};
