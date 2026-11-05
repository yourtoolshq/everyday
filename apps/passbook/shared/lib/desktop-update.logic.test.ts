import { describe, expect, it } from "vitest";

import type { DesktopUpdateState } from "./desktop-update.types";
import {
  getDesktopUpdateActionError,
  getDesktopUpdateButtonLabel,
  getDesktopUpdateButtonTooltip,
  getDesktopUpdateInstallConfirmationMessage,
  getDesktopUpdateReleaseUrl,
  isDesktopUpdateButtonDisabled,
  resolveDesktopUpdateButtonAction,
  shouldShowDesktopUpdateButton,
} from "./desktop-update.logic";

function baseState(
  overrides: Partial<DesktopUpdateState> = {},
): DesktopUpdateState {
  return {
    enabled: true,
    status: "idle",
    currentVersion: "0.1.0",
    availableVersion: null,
    downloadedVersion: null,
    releaseNotes: [],
    downloadPercent: null,
    message: null,
    errorContext: null,
    dismissed: false,
    trial: null,
    ...overrides,
  };
}

describe("desktop update logic", () => {
  it("links a Passbook update to its semver GitHub tag", () => {
    expect(getDesktopUpdateReleaseUrl("0.1.1-passbook.20260307.42")).toBe(
      "https://github.com/yourtoolshq/everyday/releases/tag/v0.1.1-passbook.20260307.42",
    );
  });

  it("shows download action when an update is available", () => {
    const state = baseState({
      status: "available",
      availableVersion: "0.1.1",
    });
    expect(resolveDesktopUpdateButtonAction(state)).toBe("download");
    expect(shouldShowDesktopUpdateButton(state)).toBe(true);
    expect(getDesktopUpdateButtonLabel(state)).toBe("Update available");
  });

  it("shows install action when a download completes", () => {
    const state = baseState({
      status: "downloaded",
      availableVersion: "0.1.1",
      downloadedVersion: "0.1.1",
    });
    expect(resolveDesktopUpdateButtonAction(state)).toBe("install");
    expect(getDesktopUpdateButtonLabel(state)).toBe("Restart to update");
  });

  it("uses the same action button to check for updates", () => {
    expect(resolveDesktopUpdateButtonAction(baseState())).toBe("check");
    expect(getDesktopUpdateButtonLabel(baseState())).toBe("Check for updates");
  });

  it("blocks repeated install actions while native staging is pending", () => {
    const state = baseState({
      status: "installing",
      downloadedVersion: "0.1.1",
    });
    expect(resolveDesktopUpdateButtonAction(state)).toBe("none");
    expect(isDesktopUpdateButtonDisabled(state)).toBe(true);
    expect(getDesktopUpdateButtonLabel(state)).toBe(
      "Preparing update and restart",
    );
    expect(getDesktopUpdateButtonTooltip(state)).toContain(
      "restart when it is ready",
    );
  });

  it("explains an install rejected because the desktop does not own the host", () => {
    const state = baseState({
      status: "downloaded",
      downloadedVersion: "0.1.1",
      errorContext: "install",
      message: "Passbook is connected to an external data host.",
    });
    expect(
      getDesktopUpdateActionError({ accepted: false, completed: false, state }),
    ).toBe(state.message);
    expect(getDesktopUpdateButtonTooltip(state)).toBe(state.message);
  });

  it("hides the pill while a post-update trial is active", () => {
    expect(
      shouldShowDesktopUpdateButton(
        baseState({
          status: "available",
          availableVersion: "0.1.1",
          trial: {
            targetVersion: "0.1.1",
            previousVersion: "0.1.0",
            backupId: "backup-1",
            status: "verifying",
          },
        }),
      ),
    ).toBe(false);
  });

  it("keeps the single action visible while checking and downloading", () => {
    expect(
      shouldShowDesktopUpdateButton(baseState({ status: "checking" })),
    ).toBe(true);
    expect(
      shouldShowDesktopUpdateButton(baseState({ status: "downloading" })),
    ).toBe(true);
  });

  it("includes the downloaded version in the install confirmation", () => {
    expect(
      getDesktopUpdateInstallConfirmationMessage({
        availableVersion: "0.1.1",
        downloadedVersion: "0.1.1",
      }),
    ).toContain("0.1.1");
  });
});
