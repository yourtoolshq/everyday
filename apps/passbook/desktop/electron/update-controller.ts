import type { App, BrowserWindow } from "electron";
import { app as defaultElectronApp } from "electron";

import type { UpdateIntent } from "./update-orchestrator.js";
import type {
  DesktopUpdateActionResult,
  DesktopUpdateState,
  DesktopUpdateTrialState,
} from "./update-types.js";
import {
  applyPassbookAutoUpdaterChannel,
  autoUpdater,
  stageDownloadedUpdate as defaultStageDownloadedUpdate,
  resetNativeStageCache,
} from "./auto-updater.js";
import { normalizeDesktopUpdateReleaseNotes } from "./release-notes.js";
import { appendUpdateHistory } from "./update-history.js";
import {
  clearUpdateInstallQuitPending,
  markUpdateInstallQuitPending,
} from "./update-install-quit.js";
import { UpdateOrchestrator } from "./update-orchestrator.js";
import {
  createInitialDesktopUpdateState,
  reduceOnCheckFailure,
  reduceOnCheckStart,
  reduceOnDownloadComplete,
  reduceOnDownloadFailure,
  reduceOnDownloadProgress,
  reduceOnDownloadStart,
  reduceOnInstallFailure,
  reduceOnInstallStart,
  reduceOnNoUpdate,
  reduceOnUpdateAvailable,
} from "./update-state.js";

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const DEFAULT_NATIVE_STAGING_TIMEOUT_MS = 120_000;
const DEFAULT_QUIT_HANDOFF_TIMEOUT_MS = 120_000;

const EXTERNAL_HOST_INSTALL_MESSAGE =
  "Passbook is connected to an external data host. Quit Passbook and any external host, then open Passbook from the application folder to install updates.";

export interface UpdateControllerOptions {
  dataDir: string;
  hostUrl: string;
  currentVersion: string;
  preInstallPrepare?: () => Promise<void>;
  isHostExternal?: () => boolean;
  onInstallFailureRecover?: () => Promise<void>;
  stageDownloadedUpdate?: (
    timeoutMs?: number,
    downloadedVersion?: string,
  ) => Promise<void>;
  installStagingTimeoutMs?: number;
  quitHandoffTimeoutMs?: number;
  checkIntervalMs?: number;
  electronApp?: Pick<App, "on" | "removeListener">;
}

interface PreUpdateBackupRecord {
  id: string;
  verification?: { status?: string };
}

interface PlatformStatusResponse {
  state?: string;
  version?: string | null;
}

async function createPreUpdateBackup(hostUrl: string) {
  const response = await fetch(`${hostUrl}/api/data/trpc/backups.create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = (await response.json()) as {
    result?: { data?: PreUpdateBackupRecord };
    error?: { message?: string };
  };

  const backup = body.result?.data;
  if (!response.ok || !backup?.id) {
    throw new Error(
      "Passbook could not create a verified backup before updating.",
    );
  }
  if (backup.verification?.status !== "verified") {
    throw new Error("Passbook created a backup, but verification failed.");
  }
  return backup.id;
}

async function assertPlatformReadyForCommit(
  hostUrl: string,
  targetVersion: string,
) {
  const response = await fetch(`${hostUrl}/api/data/status`, {
    cache: "no-store",
  } as RequestInit);
  const body = (await response.json()) as PlatformStatusResponse;
  if (!response.ok || body.state !== "ready") {
    throw new Error("Passbook is not ready to finalize the update.");
  }
  if (body.version !== targetVersion) {
    throw new Error(
      `Expected version ${targetVersion}, but the host reported ${body.version ?? "unknown"}.`,
    );
  }
}

export class UpdateController {
  private state: DesktopUpdateState;
  private readonly orchestrator: UpdateOrchestrator;
  private readonly electronApp: Pick<App, "on" | "removeListener">;
  private readonly listeners = new Set<(state: DesktopUpdateState) => void>();
  private windows = new Set<BrowserWindow>();
  private actionInFlight = false;
  private installStagingActive = false;
  private quitHandoffActive = false;
  private hostStoppedForInstall = false;
  private started = false;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private stagingWatchdog: ReturnType<typeof setTimeout> | null = null;
  private installFailureRecoveryInFlight: Promise<void> | null = null;
  private onBeforeQuit: (() => void) | null = null;
  private readonly autoUpdaterHandlers = new Map<
    string,
    (...args: unknown[]) => void
  >();

  constructor(private readonly options: UpdateControllerOptions) {
    this.orchestrator = new UpdateOrchestrator({ dataDir: options.dataDir });
    this.electronApp = options.electronApp ?? defaultElectronApp;
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

  dispose() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.cancelQuitHandoffWatchdog();
    if (this.onBeforeQuit) {
      this.electronApp.removeListener("before-quit", this.onBeforeQuit);
      this.onBeforeQuit = null;
    }
    for (const [event, handler] of this.autoUpdaterHandlers) {
      autoUpdater.removeListener(
        event as Parameters<typeof autoUpdater.removeListener>[0],
        handler,
      );
    }
    this.autoUpdaterHandlers.clear();
    this.started = false;
  }

  async start() {
    if (this.started) return;
    this.started = true;

    await this.resumePendingIntent();
    this.bindAutoUpdater();
    this.bindQuitSignals();

    const checkForUpdates = () => {
      void this.checkForUpdates().catch((error) => {
        console.error("Passbook update check failed:", error);
      });
    };

    checkForUpdates();
    this.checkInterval = setInterval(
      checkForUpdates,
      this.options.checkIntervalMs ?? UPDATE_CHECK_INTERVAL_MS,
    );
  }

  dismiss() {
    this.state = { ...this.state, dismissed: true };
    this.broadcast();
  }

  async checkForUpdates(): Promise<DesktopUpdateActionResult> {
    if (!this.state.enabled || this.isUpdateFlowLocked()) {
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
      this.state.status !== "available" ||
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
    const version = this.state.downloadedVersion;
    if (
      !this.state.enabled ||
      this.actionInFlight ||
      this.state.trial ||
      this.state.status !== "downloaded" ||
      !version
    ) {
      return { accepted: false, completed: false, state: this.getState() };
    }

    if (this.options.isHostExternal?.()) {
      const message = EXTERNAL_HOST_INSTALL_MESSAGE;
      this.state = { ...this.state, message, errorContext: "install" };
      this.broadcast();
      return { accepted: false, completed: false, state: this.getState() };
    }

    this.actionInFlight = true;
    this.installStagingActive = true;
    this.state = reduceOnInstallStart(this.state);
    this.broadcast();

    try {
      await this.orchestrator.beginUpdate(version, this.options.currentVersion);
      const backupId = await createPreUpdateBackup(this.options.hostUrl);
      await this.orchestrator.markBackupComplete(backupId);
      void this.logHistory({
        event: "install",
        stage: "backup",
        currentVersion: this.options.currentVersion,
        targetVersion: version,
        result: "ok",
      });

      void this.logHistory({
        event: "install",
        stage: "native_stage",
        currentVersion: this.options.currentVersion,
        targetVersion: version,
      });

      const stageDownloadedUpdate =
        this.options.stageDownloadedUpdate ??
        ((timeoutMs?: number, downloadedVersion?: string) =>
          defaultStageDownloadedUpdate(
            timeoutMs ?? DEFAULT_NATIVE_STAGING_TIMEOUT_MS,
            {},
            downloadedVersion ?? version,
          ));
      try {
        await stageDownloadedUpdate(
          this.options.installStagingTimeoutMs ??
            DEFAULT_NATIVE_STAGING_TIMEOUT_MS,
          version,
        );
        void this.logHistory({
          event: "install",
          stage: "native_stage",
          currentVersion: this.options.currentVersion,
          targetVersion: version,
          result: "ok",
        });
      } catch (stageError) {
        const stageMessage =
          stageError instanceof Error
            ? stageError.message
            : "Native update staging failed.";
        void this.logHistory({
          event: "install",
          stage: "native_stage",
          currentVersion: this.options.currentVersion,
          targetVersion: version,
          result: "failed",
          error: stageMessage,
        });
        await this.performInstallFailureRecovery(stageMessage, version);
        return { accepted: true, completed: false, state: this.getState() };
      }

      if (this.options.preInstallPrepare) {
        this.hostStoppedForInstall = true;
        void this.logHistory({
          event: "install",
          stage: "host_stop",
          currentVersion: this.options.currentVersion,
          targetVersion: version,
        });
        await this.options.preInstallPrepare();
        void this.logHistory({
          event: "install",
          stage: "host_stop",
          currentVersion: this.options.currentVersion,
          targetVersion: version,
          result: "ok",
        });
      }

      markUpdateInstallQuitPending();
      this.quitHandoffActive = true;
      this.scheduleQuitHandoffWatchdog();

      await this.logHistory({
        event: "install",
        stage: "quit_handoff",
        currentVersion: this.options.currentVersion,
        targetVersion: version,
        result: "ok",
      });

      autoUpdater.quitAndInstall(false, true);
      return { accepted: true, completed: false, state: this.getState() };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Update install failed.";
      await this.performInstallFailureRecovery(message, version);
      return { accepted: true, completed: false, state: this.getState() };
    }
  }

  async commitTrial(): Promise<DesktopUpdateActionResult> {
    const intent = await this.orchestrator.readIntent();
    if (
      intent?.stage !== "trial" ||
      !intent.backupId ||
      this.options.currentVersion !== intent.targetVersion
    ) {
      return { accepted: false, completed: false, state: this.getState() };
    }

    try {
      await assertPlatformReadyForCommit(
        this.options.hostUrl,
        intent.targetVersion,
      );
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
      await this.markTrialFailed(message);
      return { accepted: true, completed: false, state: this.getState() };
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

  async dismissTrialFailure(): Promise<DesktopUpdateActionResult> {
    const intent = await this.orchestrator.readIntent();
    if (intent?.stage !== "failed") {
      return { accepted: false, completed: false, state: this.getState() };
    }

    await this.orchestrator.dismissFailedIntent();
    this.state = {
      ...this.state,
      trial: null,
      message: null,
      errorContext: null,
    };
    this.broadcast();
    return { accepted: true, completed: true, state: this.getState() };
  }

  private isUpdateFlowLocked() {
    return (
      this.actionInFlight ||
      this.installStagingActive ||
      this.state.trial !== null ||
      this.state.status === "checking" ||
      this.state.status === "downloading" ||
      this.state.status === "downloaded" ||
      this.state.status === "installing"
    );
  }

  private preservesDownloadedIdentity() {
    return (
      this.state.status === "downloaded" ||
      this.state.status === "installing" ||
      this.installStagingActive
    );
  }

  private resetInstallFlowFlags() {
    this.installStagingActive = false;
    this.quitHandoffActive = false;
    this.actionInFlight = false;
    this.cancelQuitHandoffWatchdog();
  }

  private scheduleQuitHandoffWatchdog() {
    this.cancelQuitHandoffWatchdog();
    const timeoutMs =
      this.options.quitHandoffTimeoutMs ?? DEFAULT_QUIT_HANDOFF_TIMEOUT_MS;
    this.stagingWatchdog = setTimeout(() => {
      void this.handleQuitHandoffWatchdogTimeout();
    }, timeoutMs);
  }

  private cancelQuitHandoffWatchdog() {
    if (this.stagingWatchdog) {
      clearTimeout(this.stagingWatchdog);
      this.stagingWatchdog = null;
    }
  }

  private logHistory(
    entry: Parameters<typeof appendUpdateHistory>[1],
  ): Promise<void> {
    return appendUpdateHistory(this.options.dataDir, entry);
  }

  private performInstallFailureRecovery(
    message: string,
    targetVersion?: string,
  ): Promise<void> {
    if (this.installFailureRecoveryInFlight) {
      return this.installFailureRecoveryInFlight;
    }

    this.installFailureRecoveryInFlight = this.runInstallFailureRecovery(
      message,
      targetVersion,
    ).finally(() => {
      this.installFailureRecoveryInFlight = null;
    });
    return this.installFailureRecoveryInFlight;
  }

  private async runInstallFailureRecovery(
    message: string,
    targetVersion?: string,
  ) {
    const intentBefore = await this.orchestrator.readIntent();
    if (intentBefore && intentBefore.stage !== "failed") {
      await this.orchestrator.markFailed(message).catch(() => undefined);
    }
    const intent = (await this.orchestrator.readIntent()) ?? intentBefore;

    void this.logHistory({
      event: "install",
      stage: this.quitHandoffActive ? "quit_handoff" : "recovery",
      currentVersion: this.options.currentVersion,
      targetVersion: targetVersion ?? intent?.targetVersion,
      result: "failed",
      error: message,
    });

    clearUpdateInstallQuitPending();

    if (this.hostStoppedForInstall && this.options.onInstallFailureRecover) {
      void this.logHistory({
        event: "install",
        stage: "host_recover",
        currentVersion: this.options.currentVersion,
        targetVersion: targetVersion ?? intent?.targetVersion,
      });
      try {
        await this.options.onInstallFailureRecover();
        void this.logHistory({
          event: "install",
          stage: "host_recover",
          currentVersion: this.options.currentVersion,
          targetVersion: targetVersion ?? intent?.targetVersion,
          result: "ok",
        });
      } catch (error) {
        console.error("Passbook could not recover the data host:", error);
        void this.logHistory({
          event: "install",
          stage: "host_recover",
          currentVersion: this.options.currentVersion,
          targetVersion: targetVersion ?? intent?.targetVersion,
          result: "failed",
          error:
            error instanceof Error
              ? error.message
              : "Host recovery failed after update install failure.",
        });
      }
    }
    this.hostStoppedForInstall = false;
    this.resetInstallFlowFlags();

    this.state = {
      ...reduceOnInstallFailure(this.state, message),
      ...(intent ? { trial: toTrialState(intent, "failed", message) } : {}),
    };
    this.broadcast();
  }

  private async handleQuitHandoffWatchdogTimeout() {
    if (!this.quitHandoffActive) return;
    const reason =
      "Passbook could not restart to install the update. Try again, or quit Passbook completely from the menu bar before reopening.";
    void this.logHistory({
      event: "install",
      stage: "quit_handoff",
      currentVersion: this.options.currentVersion,
      targetVersion: this.state.downloadedVersion ?? undefined,
      result: "timeout",
      error: reason,
    });
    await this.performInstallFailureRecovery(
      reason,
      this.state.downloadedVersion ?? undefined,
    );
  }

  private async handleQuitHandoffError(message: string) {
    if (!this.quitHandoffActive) return;
    await this.performInstallFailureRecovery(
      message,
      this.state.downloadedVersion ?? undefined,
    );
  }

  private bindQuitSignals() {
    this.onBeforeQuit = () => {
      this.cancelQuitHandoffWatchdog();
    };
    this.electronApp.on("before-quit", this.onBeforeQuit);
  }

  private bindAutoUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    applyPassbookAutoUpdaterChannel();

    const onError = (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Update check failed.";
      if (this.quitHandoffActive) {
        void this.handleQuitHandoffError(message);
        return;
      }
      console.error("Passbook update check failed:", error);
      if (this.state.status === "checking") {
        this.state = reduceOnCheckFailure(this.state, message);
        this.broadcast();
      }
    };

    const onUpdateAvailable = (...args: unknown[]) => {
      const info = args[0] as {
        version: string;
        releaseNotes?: unknown;
      };
      if (this.preservesDownloadedIdentity()) return;
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
    };

    const onUpdateNotAvailable = () => {
      if (this.preservesDownloadedIdentity()) return;
      this.state = reduceOnNoUpdate(this.state);
      this.broadcast();
    };

    const onDownloadProgress = (...args: unknown[]) => {
      const progress = args[0] as { percent: number };
      this.state = reduceOnDownloadProgress(this.state, progress.percent);
      this.broadcast();
    };

    const onUpdateDownloaded = (...args: unknown[]) => {
      const info = args[0] as { version: string };
      if (this.installStagingActive) return;
      if (this.state.downloadedVersion !== info.version) {
        resetNativeStageCache();
      }
      this.state = reduceOnDownloadComplete(this.state, info.version);
      this.broadcast();
    };

    autoUpdater.on("error", onError);
    autoUpdater.on("update-available", onUpdateAvailable);
    autoUpdater.on("update-not-available", onUpdateNotAvailable);
    autoUpdater.on("download-progress", onDownloadProgress);
    autoUpdater.on("update-downloaded", onUpdateDownloaded);

    this.autoUpdaterHandlers.set("error", onError);
    this.autoUpdaterHandlers.set("update-available", onUpdateAvailable);
    this.autoUpdaterHandlers.set("update-not-available", onUpdateNotAvailable);
    this.autoUpdaterHandlers.set("download-progress", onDownloadProgress);
    this.autoUpdaterHandlers.set("update-downloaded", onUpdateDownloaded);
  }

  private async resumePendingIntent() {
    const intent = await this.orchestrator.readIntent();
    if (!intent) return;

    if (intent.stage === "commit") {
      await this.resumeCommitIntent(intent);
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
      if (
        this.options.currentVersion === intent.targetVersion &&
        intent.backupId
      ) {
        this.state = {
          ...this.state,
          trial: toTrialState(intent, "verifying"),
        };
        return;
      }

      const reason =
        this.options.currentVersion === intent.previousVersion
          ? "The update did not finish installing. Passbook is still on the previous version."
          : "The update did not finish on the expected version.";
      await this.orchestrator.markFailed(reason);
      this.state = {
        ...this.state,
        trial: toTrialState(intent, "failed", reason),
      };
    }
  }

  private async resumeCommitIntent(intent: UpdateIntent) {
    if (
      this.options.currentVersion !== intent.targetVersion ||
      !intent.backupId
    ) {
      const reason = "The update did not finish on the expected version.";
      await this.orchestrator.markFailed(reason);
      this.state = {
        ...this.state,
        trial: toTrialState(intent, "failed", reason),
      };
      this.broadcast();
      return;
    }

    try {
      await assertPlatformReadyForCommit(
        this.options.hostUrl,
        intent.targetVersion,
      );
      await this.orchestrator.commit();
      this.state = { ...this.state, trial: null };
      this.broadcast();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not finalize the update.";
      await this.orchestrator.markFailed(message).catch(() => undefined);
      this.state = {
        ...this.state,
        trial: toTrialState(intent, "failed", message),
      };
      this.broadcast();
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
