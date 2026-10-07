import type { BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";

import { normalizeDesktopUpdateReleaseNotes } from "./release-notes.js";
import {
  createInitialDesktopUpdateState,
  reduceOnCheckFailure,
  reduceOnCheckStart,
  reduceOnDownloadComplete,
  reduceOnDownloadFailure,
  reduceOnDownloadProgress,
  reduceOnDownloadStart,
  reduceOnInstallFailure,
  reduceOnNoUpdate,
  reduceOnUpdateAvailable,
} from "./update-state.js";
import type {
  DesktopUpdateActionResult,
  DesktopUpdateState,
  DesktopUpdateTrialState,
} from "./update-types.js";
import { UpdateOrchestrator } from "./update-orchestrator.js";

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

export interface UpdateControllerOptions {
  dataDir: string;
  hostUrl: string;
  currentVersion: string;
}

async function createPreUpdateBackup(hostUrl: string) {
  const response = await fetch(`${hostUrl}/api/data/trpc/backups.create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: null }),
  });
  const body = (await response.json()) as {
    result?: {
      data?: { json?: { id?: string; verification?: { ok?: boolean } } };
    };
    error?: unknown;
  };

  if (!response.ok || !body.result?.data?.json?.id) {
    throw new Error(
      "Passbook could not create a verified backup before updating.",
    );
  }
  if (body.result.data.json.verification?.ok !== true) {
    throw new Error("Passbook created a backup, but verification failed.");
  }
  return body.result.data.json.id;
}

export class UpdateController {
  private state: DesktopUpdateState;
  private readonly orchestrator: UpdateOrchestrator;
  private readonly listeners = new Set<(state: DesktopUpdateState) => void>();
  private windows = new Set<BrowserWindow>();
  private actionInFlight = false;
  private started = false;

  constructor(private readonly options: UpdateControllerOptions) {
    this.orchestrator = new UpdateOrchestrator({ dataDir: options.dataDir });
    this.state = createInitialDesktopUpdateState(options.currentVersion, true);
  }

  registerWindow(window: BrowserWindow) {
    this.windows.add(window);
    window.on("closed", () => {
      this.windows.delete(window);
    });
  }

  subscribe(listener: (state: DesktopUpdateState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): DesktopUpdateState {
    return this.state;
  }

  async start() {
    if (this.started) return;
    this.started = true;

    await this.resumePendingIntent();
    this.bindAutoUpdater();

    const checkForUpdates = () => {
      void this.checkForUpdates().catch((error) => {
        console.error("Passbook update check failed:", error);
      });
    };

    setTimeout(checkForUpdates, 15_000);
    setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
  }

  dismiss() {
    this.state = { ...this.state, dismissed: true };
    this.broadcast();
  }

  async checkForUpdates(): Promise<DesktopUpdateActionResult> {
    if (!this.state.enabled || this.actionInFlight || this.state.trial) {
      return { accepted: false, completed: false, state: this.getState() };
    }
    this.state = reduceOnCheckStart(this.state);
    this.broadcast();
    try {
      await autoUpdater.checkForUpdates();
      return { accepted: true, completed: true, state: this.getState() };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Update check failed.";
      this.state = reduceOnCheckFailure(this.state, message);
      this.broadcast();
      return { accepted: true, completed: false, state: this.getState() };
    }
  }

  async downloadUpdate(): Promise<DesktopUpdateActionResult> {
    if (
      !this.state.enabled ||
      this.actionInFlight ||
      this.state.trial ||
      !this.state.availableVersion
    ) {
      return { accepted: false, completed: false, state: this.getState() };
    }

    this.actionInFlight = true;
    this.state = reduceOnDownloadStart(this.state);
    this.broadcast();

    try {
      await autoUpdater.downloadUpdate();
      return { accepted: true, completed: true, state: this.getState() };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Update download failed.";
      this.state = reduceOnDownloadFailure(this.state, message);
      this.broadcast();
      return { accepted: true, completed: false, state: this.getState() };
    } finally {
      this.actionInFlight = false;
    }
  }

  async installUpdate(): Promise<DesktopUpdateActionResult> {
    const version =
      this.state.downloadedVersion ?? this.state.availableVersion;
    if (
      !this.state.enabled ||
      this.actionInFlight ||
      this.state.trial ||
      !version
    ) {
      return { accepted: false, completed: false, state: this.getState() };
    }

    this.actionInFlight = true;
    try {
      await this.orchestrator.beginUpdate(
        version,
        this.options.currentVersion,
      );
      const backupId = await createPreUpdateBackup(this.options.hostUrl);
      await this.orchestrator.markBackupComplete(backupId);
      autoUpdater.quitAndInstall();
      return { accepted: true, completed: false, state: this.getState() };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Update install failed.";
      await this.orchestrator.markFailed(message).catch(() => undefined);
      this.state = reduceOnInstallFailure(this.state, message);
      this.broadcast();
      return { accepted: true, completed: false, state: this.getState() };
    } finally {
      this.actionInFlight = false;
    }
  }

  async commitTrial(): Promise<DesktopUpdateActionResult> {
    const intent = await this.orchestrator.readIntent();
    if (intent?.stage !== "trial") {
      return { accepted: false, completed: false, state: this.getState() };
    }

    try {
      await this.orchestrator.markTrialReady();
      await this.orchestrator.commit();
      this.state = { ...this.state, trial: null };
      this.broadcast();
      return { accepted: true, completed: true, state: this.getState() };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not finalize the update.";
      return this.markTrialFailed(message);
    }
  }

  async markTrialFailed(reason: string): Promise<DesktopUpdateActionResult> {
    const intent = await this.orchestrator.readIntent();
    if (!intent || intent.stage === "failed") {
      this.state = {
        ...this.state,
        trial: this.state.trial
          ? { ...this.state.trial, status: "failed", failureReason: reason }
          : null,
      };
      this.broadcast();
      return { accepted: false, completed: false, state: this.getState() };
    }

    await this.orchestrator.markFailed(reason);
    this.state = {
      ...this.state,
      trial: toTrialState(intent, "failed", reason),
    };
    this.broadcast();
    return { accepted: true, completed: true, state: this.getState() };
  }

  private bindAutoUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on("error", (error) => {
      console.error("Passbook update check failed:", error);
      if (this.state.status === "checking") {
        this.state = reduceOnCheckFailure(
          this.state,
          error instanceof Error ? error.message : "Update check failed.",
        );
        this.broadcast();
      }
    });

    autoUpdater.on("update-available", (info) => {
      const releaseNotes = normalizeDesktopUpdateReleaseNotes(
        info.version,
        info.releaseNotes,
      );
      this.state = reduceOnUpdateAvailable(
        this.state,
        info.version,
        releaseNotes,
      );
      this.broadcast();
    });

    autoUpdater.on("update-not-available", () => {
      this.state = reduceOnNoUpdate(this.state);
      this.broadcast();
    });

    autoUpdater.on("download-progress", (progress) => {
      this.state = reduceOnDownloadProgress(this.state, progress.percent);
      this.broadcast();
    });

    autoUpdater.on("update-downloaded", (info) => {
      this.state = reduceOnDownloadComplete(this.state, info.version);
      this.broadcast();
    });
  }

  private async resumePendingIntent() {
    const intent = await this.orchestrator.readIntent();
    if (!intent) return;

    if (intent.stage === "commit") {
      await this.orchestrator.commit().catch(() => undefined);
      return;
    }

    if (intent.stage === "failed") {
      this.state = {
        ...this.state,
        trial: toTrialState(
          intent,
          "failed",
          intent.failureReason ?? "The update did not finish.",
        ),
      };
      return;
    }

    if (intent.stage === "backup") {
      const reason = "A previous update did not finish during backup.";
      await this.orchestrator.markFailed(reason);
      this.state = {
        ...this.state,
        trial: toTrialState(intent, "failed", reason),
      };
      return;
    }

    if (intent.stage === "trial") {
      this.state = {
        ...this.state,
        trial: toTrialState(intent, "verifying"),
      };
    }
  }

  private broadcast() {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
    for (const window of this.windows) {
      if (window.isDestroyed()) continue;
      window.webContents.send("passbook:update:state", snapshot);
    }
  }
}

function toTrialState(
  intent: {
    targetVersion: string;
    previousVersion: string;
    backupId?: string;
  },
  status: DesktopUpdateTrialState["status"],
  failureReason?: string,
): DesktopUpdateTrialState {
  return {
    targetVersion: intent.targetVersion,
    previousVersion: intent.previousVersion,
    backupId: intent.backupId ?? "",
    status,
    failureReason,
  };
}
