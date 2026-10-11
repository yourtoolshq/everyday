import { createRequire } from "node:module";
import type * as ElectronUpdaterModule from "electron-updater";
import { autoUpdater as electronNativeAutoUpdater } from "electron";

const require = createRequire(import.meta.url);

const updater = require("electron-updater") as typeof ElectronUpdaterModule;

export const autoUpdater = updater.autoUpdater;

export const PASSBOOK_UPDATE_CHANNEL = "passbook";

export function applyPassbookAutoUpdaterChannel(
  target: Pick<
    typeof autoUpdater,
    "channel" | "allowPrerelease" | "allowDowngrade"
  > = autoUpdater,
) {
  target.channel = PASSBOOK_UPDATE_CHANNEL;
  target.allowPrerelease = true;
  target.allowDowngrade = false;
}

export interface NativeAutoUpdaterLike {
  once: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener: (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => void;
  checkForUpdates: () => void;
}

export interface StageDownloadedUpdateDeps {
  nativeAutoUpdater?: NativeAutoUpdaterLike;
  platform?: NodeJS.Platform;
}

let nativeStagedDownloadVersion: string | null = null;

export function getNativeStagedDownloadVersion() {
  return nativeStagedDownloadVersion;
}

export function resetNativeStageCache() {
  nativeStagedDownloadVersion = null;
}

export function markNativeStageCached(downloadedVersion: string) {
  nativeStagedDownloadVersion = downloadedVersion;
}

export function parseNativeAutoUpdaterError(...args: unknown[]): Error {
  const [first, second] = args;
  if (first instanceof Error) return first;
  if (typeof first === "string" && first.length > 0) {
    return new Error(first);
  }
  if (second instanceof Error) return second;
  if (typeof second === "string" && second.length > 0) {
    return new Error(second);
  }
  return new Error("Native update staging failed.");
}

export async function stageDownloadedUpdate(
  timeoutMs = 120_000,
  deps: StageDownloadedUpdateDeps = {},
  downloadedVersion?: string,
): Promise<void> {
  const platform = deps.platform ?? process.platform;
  if (platform !== "darwin") {
    return;
  }

  if (downloadedVersion && nativeStagedDownloadVersion === downloadedVersion) {
    return;
  }

  const nativeAutoUpdater: NativeAutoUpdaterLike = deps.nativeAutoUpdater ?? {
    once: (event, listener) => {
      // Electron's autoUpdater typings only cover a subset of event names.
      electronNativeAutoUpdater.once(event as "update-downloaded", listener);
    },
    removeListener: (event, listener) => {
      electronNativeAutoUpdater.removeListener(
        event as "update-downloaded",
        listener,
      );
    },
    checkForUpdates: () => {
      electronNativeAutoUpdater.checkForUpdates();
    },
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      nativeAutoUpdater.removeListener("update-downloaded", onDownloaded);
      nativeAutoUpdater.removeListener("error", onError);
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };

    const onDownloaded = () => {
      if (downloadedVersion) {
        markNativeStageCached(downloadedVersion);
      }
      finish();
    };

    const onError = (...args: unknown[]) => {
      finish(parseNativeAutoUpdaterError(...args));
    };

    nativeAutoUpdater.once("update-downloaded", onDownloaded);
    nativeAutoUpdater.once("error", onError);

    timer = setTimeout(() => {
      finish(new Error("Native update staging timed out."));
    }, timeoutMs);

    try {
      nativeAutoUpdater.checkForUpdates();
    } catch (error) {
      finish(
        error instanceof Error
          ? error
          : new Error("Native update staging failed."),
      );
    }
  });
}
