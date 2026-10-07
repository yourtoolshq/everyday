import type {
  DesktopUpdateReleaseNote,
  DesktopUpdateState,
  DesktopUpdateStatus,
} from "./update-types.js";

export function createInitialDesktopUpdateState(
  currentVersion: string,
  enabled: boolean,
): DesktopUpdateState {
  return {
    enabled,
    status: enabled ? "idle" : "disabled",
    currentVersion,
    availableVersion: null,
    downloadedVersion: null,
    releaseNotes: [],
    downloadPercent: null,
    message: null,
    errorContext: null,
    dismissed: false,
    trial: null,
  };
}

function nextStatusAfterDownloadFailure(
  state: DesktopUpdateState,
): DesktopUpdateStatus {
  return state.availableVersion ? "available" : "error";
}

export function reduceOnCheckStart(state: DesktopUpdateState): DesktopUpdateState {
  return {
    ...state,
    status: "checking",
    releaseNotes: [],
    message: null,
    downloadPercent: null,
    errorContext: null,
  };
}

export function reduceOnCheckFailure(
  state: DesktopUpdateState,
  message: string,
): DesktopUpdateState {
  return {
    ...state,
    status: "error",
    message,
    downloadPercent: null,
    errorContext: "check",
  };
}

export function reduceOnUpdateAvailable(
  state: DesktopUpdateState,
  version: string,
  releaseNotes: readonly DesktopUpdateReleaseNote[],
): DesktopUpdateState {
  return {
    ...state,
    status: "available",
    availableVersion: version,
    downloadedVersion: null,
    releaseNotes: [...releaseNotes],
    downloadPercent: null,
    message: null,
    errorContext: null,
    dismissed: false,
  };
}

export function reduceOnNoUpdate(state: DesktopUpdateState): DesktopUpdateState {
  return {
    ...state,
    status: "up-to-date",
    availableVersion: null,
    downloadedVersion: null,
    releaseNotes: [],
    downloadPercent: null,
    message: null,
    errorContext: null,
  };
}

export function reduceOnDownloadStart(state: DesktopUpdateState): DesktopUpdateState {
  return {
    ...state,
    status: "downloading",
    downloadPercent: 0,
    message: null,
    errorContext: null,
  };
}

export function reduceOnDownloadProgress(
  state: DesktopUpdateState,
  percent: number,
): DesktopUpdateState {
  return {
    ...state,
    status: "downloading",
    downloadPercent: percent,
    message: null,
    errorContext: null,
  };
}

export function reduceOnDownloadComplete(
  state: DesktopUpdateState,
  version: string,
): DesktopUpdateState {
  return {
    ...state,
    status: "downloaded",
    availableVersion: version,
    downloadedVersion: version,
    downloadPercent: 100,
    message: null,
    errorContext: null,
  };
}

export function reduceOnDownloadFailure(
  state: DesktopUpdateState,
  message: string,
): DesktopUpdateState {
  return {
    ...state,
    status: nextStatusAfterDownloadFailure(state),
    message,
    downloadPercent: null,
    errorContext: "download",
  };
}

export function reduceOnInstallFailure(
  state: DesktopUpdateState,
  message: string,
): DesktopUpdateState {
  return {
    ...state,
    status: "downloaded",
    message,
    errorContext: "install",
  };
}
