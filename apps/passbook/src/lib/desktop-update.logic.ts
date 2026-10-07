import type {
  DesktopUpdateActionResult,
  DesktopUpdateState,
} from "./desktop-update.types";

export type DesktopUpdateButtonAction = "download" | "install" | "none";

const DESKTOP_RELEASE_TAG_URL =
  "https://github.com/yourtoolshq/everyday/releases/tag";

export function isPassbookDesktop() {
  return typeof window !== "undefined" && Boolean(window.passbookDesktop);
}

export function getDesktopUpdatesBridge() {
  return window.passbookDesktop?.updates ?? null;
}

export function getDesktopUpdateDownloadedVersion(
  state: DesktopUpdateState,
): string | null {
  return state.downloadedVersion ?? state.availableVersion;
}

export function getDesktopUpdateReleaseUrl(
  version: string | null,
): string | null {
  const normalizedVersion = version?.trim();
  if (!normalizedVersion) return null;
  const tag = normalizedVersion.startsWith("passbook-v")
    ? normalizedVersion
    : `passbook-v${normalizedVersion}`;
  return `${DESKTOP_RELEASE_TAG_URL}/${encodeURIComponent(tag)}`;
}

export function resolveDesktopUpdateButtonAction(
  state: DesktopUpdateState,
): DesktopUpdateButtonAction {
  if (state.downloadedVersion) return "install";
  if (state.status === "available") return "download";
  if (state.status === "error" && state.errorContext === "download") {
    return state.availableVersion ? "download" : "none";
  }
  return "none";
}

export function shouldShowDesktopUpdateButton(
  state: DesktopUpdateState | null,
): boolean {
  if (!state?.enabled || state.dismissed || state.trial) return false;
  if (state.status === "downloading") return true;
  return resolveDesktopUpdateButtonAction(state) !== "none";
}

export function shouldShowDesktopUpdateCheck(
  state: DesktopUpdateState | null,
): boolean {
  return Boolean(
    state?.enabled &&
    !state.trial &&
    state.status !== "checking" &&
    state.status !== "downloading",
  );
}

export function isDesktopUpdateButtonDisabled(
  state: DesktopUpdateState | null,
): boolean {
  return state?.status === "downloading";
}

export function getDesktopUpdateButtonLabel(state: DesktopUpdateState): string {
  const action = resolveDesktopUpdateButtonAction(state);
  if (action === "install") return "Restart to update";
  if (state.status === "downloading") {
    const progress =
      typeof state.downloadPercent === "number"
        ? ` (${Math.floor(state.downloadPercent)}%)`
        : "…";
    return `Downloading${progress}`;
  }
  return "Update available";
}

export function getDesktopUpdateButtonTooltip(
  state: DesktopUpdateState,
): string {
  if (state.status === "available") {
    return `Update ${state.availableVersion ?? "available"} ready to download`;
  }
  if (state.status === "downloading") {
    const progress =
      typeof state.downloadPercent === "number"
        ? ` (${Math.floor(state.downloadPercent)}%)`
        : "";
    return `Downloading update${progress}`;
  }
  if (state.status === "downloaded") {
    return `Update ${getDesktopUpdateDownloadedVersion(state) ?? "ready"} downloaded. Click to restart and install.`;
  }
  if (state.status === "error") {
    if (state.errorContext === "download" && state.availableVersion) {
      return `Download failed for ${state.availableVersion}. Click to retry.`;
    }
    if (state.errorContext === "install" && state.downloadedVersion) {
      return `Install failed for ${state.downloadedVersion}. Click to retry.`;
    }
    return state.message ?? "Update failed";
  }
  return "Up to date";
}

export function getDesktopUpdateInstallConfirmationMessage(
  state: Pick<DesktopUpdateState, "availableVersion" | "downloadedVersion">,
): string {
  const version = getDesktopUpdateDownloadedVersion(
    state as DesktopUpdateState,
  );
  return `Install update${version ? ` ${version}` : ""} and restart Passbook?\n\nPassbook will create a verified backup before restarting. Make sure you are ready to continue.`;
}

export function getDesktopUpdateActionError(
  result: DesktopUpdateActionResult,
): string | null {
  if (!result.accepted || result.completed) return null;
  const message = result.state.message?.trim();
  return message ? message : null;
}
