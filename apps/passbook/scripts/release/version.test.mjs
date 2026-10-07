import { describe, expect, it } from "vitest";

import {
  MINIMUM_RELEASE_GAP_MS,
  parsePassbookReleaseTag,
  resolvePassbookReleaseMetadata,
  resolvePreviousPassbookTag,
  resolveTargetBaseVersion,
  shouldScheduledRelease,
} from "./version.cjs";

describe("resolveTargetBaseVersion", () => {
  it("increments the patch segment", () => {
    expect(resolveTargetBaseVersion("0.1.0")).toBe("0.1.1");
  });

  it("rejects invalid versions", () => {
    expect(() => resolveTargetBaseVersion("0.1")).toThrow(
      /Invalid desktop package version/,
    );
  });
});

describe("resolvePassbookReleaseMetadata", () => {
  it("builds tag and release name", () => {
    expect(
      resolvePassbookReleaseMetadata({
        packageVersion: "0.1.0",
        date: "20260307",
        runNumber: 42,
        sha: "abcdef1234567890",
      }),
    ).toEqual({
      baseVersion: "0.1.1",
      version: "0.1.1.20260307.42",
      packageVersion: "0.1.1-20260307.42",
      tag: "passbook-v0.1.1.20260307.42",
      name: "Passbook 0.1.1.20260307.42 (abcdef123456)",
      shortSha: "abcdef123456",
    });
  });
});

describe("parsePassbookReleaseTag", () => {
  it("parses release tags", () => {
    expect(parsePassbookReleaseTag("passbook-v0.1.1.20260307.42")).toEqual({
      major: 0,
      minor: 1,
      patch: 1,
      date: 20260307,
      runNumber: 42,
    });
  });
});

describe("resolvePreviousPassbookTag", () => {
  it("returns the newest tag before the current tag", () => {
    expect(
      resolvePreviousPassbookTag(
        [
          "passbook-v0.1.1.20260306.10",
          "passbook-v0.1.1.20260307.41",
          "passbook-v0.1.1.20260307.42",
        ],
        "passbook-v0.1.1.20260307.42",
      ),
    ).toBe("passbook-v0.1.1.20260307.41");
  });
});

describe("shouldScheduledRelease", () => {
  const now = Date.parse("2026-03-07T12:00:00Z");

  it("proceeds when no prior release exists", () => {
    expect(
      shouldScheduledRelease({
        lastPublishedAt: undefined,
        now,
        comparisonStatus: "ahead",
      }),
    ).toBe(true);
  });

  it("skips when the gap is too short", () => {
    expect(
      shouldScheduledRelease({
        lastPublishedAt: now - MINIMUM_RELEASE_GAP_MS + 60_000,
        now,
        comparisonStatus: "ahead",
      }),
    ).toBe(false);
  });

  it("skips when there are no new commits", () => {
    expect(
      shouldScheduledRelease({
        lastPublishedAt: now - MINIMUM_RELEASE_GAP_MS - 60_000,
        now,
        comparisonStatus: "identical",
      }),
    ).toBe(false);
  });

  it("proceeds when the gap passed and main moved", () => {
    expect(
      shouldScheduledRelease({
        lastPublishedAt: now - MINIMUM_RELEASE_GAP_MS - 60_000,
        now,
        comparisonStatus: "ahead",
      }),
    ).toBe(true);
  });
});
