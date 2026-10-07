import { describe, expect, it } from "vitest";

import {
  getDesktopUpdateButtonLabel,
  getDesktopUpdateInstallConfirmationMessage,
  resolveDesktopUpdateButtonAction,
  shouldShowDesktopUpdateButton,
} from "./desktop-update.logic";
import type { DesktopUpdateState } from "./desktop-update.types";

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

  it("includes the downloaded version in the install confirmation", () => {
    expect(
      getDesktopUpdateInstallConfirmationMessage({
        availableVersion: "0.1.1",
        downloadedVersion: "0.1.1",
      }),
    ).toContain("0.1.1");
  });
});
