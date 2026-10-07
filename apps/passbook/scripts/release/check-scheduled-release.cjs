const {
  MINIMUM_RELEASE_GAP_MS,
  isPassbookReleaseTag,
  shouldScheduledRelease,
} = require("./version.cjs");

async function findLatestPassbookRelease({ github, context }) {
  const releases = await github.paginate(github.rest.repos.listReleases, {
    ...context.repo,
    per_page: 100,
  });

  return releases
    .filter(
      (release) =>
        !release.draft &&
        release.published_at &&
        isPassbookReleaseTag(release.tag_name),
    )
    .sort(
      (left, right) =>
        Date.parse(right.published_at) - Date.parse(left.published_at),
    )[0];
}

async function shouldReleaseOnSchedule({
  github,
  context,
  core,
  now = Date.now(),
}) {
  const lastRelease = await findLatestPassbookRelease({ github, context });

  if (!lastRelease) {
    core.info("No published Passbook release found. Proceeding with release.");
    return true;
  }

  if (now - Date.parse(lastRelease.published_at) < MINIMUM_RELEASE_GAP_MS) {
    core.info(
      `Passbook release ${lastRelease.tag_name} was published less than six hours ago. Skipping.`,
    );
    return false;
  }

  const { data: comparison } =
    await github.rest.repos.compareCommitsWithBasehead({
      ...context.repo,
      basehead: `${lastRelease.tag_name}...${context.sha}`,
      per_page: 1,
    });

  if (comparison.status !== "ahead") {
    core.info(
      `Candidate commit is ${comparison.status} relative to ${lastRelease.tag_name}. Skipping.`,
    );
    return false;
  }

  core.info(
    `New commits since ${lastRelease.tag_name}, and the six-hour gap has passed.`,
  );
  return true;
}

module.exports = {
  findLatestPassbookRelease,
  shouldReleaseOnSchedule,
};
