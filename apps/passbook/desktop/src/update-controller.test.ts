import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isUpdateInstallQuitPending } from "../electron/update-install-quit.js";

const autoUpdaterHandlers = new Map<string, (...args: unknown[]) => void>();
const autoUpdater = {
  autoDownload: true,
  autoInstallOnAppQuit: true,
  channel: null as string | null,
  allowPrerelease: false,
  allowDowngrade: false,
  on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
    autoUpdaterHandlers.set(event, listener);
  }),
  removeListener: vi.fn(
    (event: string, listener: (...args: unknown[]) => void) => {
      if (autoUpdaterHandlers.get(event) === listener) {
        autoUpdaterHandlers.delete(event);
      }
    },
  ),
  checkForUpdates: vi.fn(() => Promise.resolve(null)),
  downloadUpdate: vi.fn(() => Promise.resolve(null)),
  quitAndInstall: vi.fn(),
};

const stageDownloadedUpdate = vi.fn(() => Promise.resolve());

vi.mock("../electron/auto-updater.js", () => ({
  autoUpdater,
  stageDownloadedUpdate,
  applyPassbookAutoUpdaterChannel: (
    target: typeof autoUpdater = autoUpdater,
  ) => {
    target.channel = "passbook";
    target.allowPrerelease = true;
    target.allowDowngrade = false;
  },
  resetNativeStageCache: vi.fn(),
  PASSBOOK_UPDATE_CHANNEL: "passbook",
}));

function mockFetchSequence(
  handlers: ((url: string) => Response | Promise<Response>)[],
) {
  let index = 0;
  return vi.fn((url: string) => {
    const handler = handlers[index] ?? handlers[handlers.length - 1];
    if (!handler) {
      throw new Error("mockFetchSequence requires at least one handler");
    }
    index += 1;
    return Promise.resolve(handler(url));
  });
}

describe("UpdateController", () => {
  let dataDir: string;
  let electronApp: {
    on: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
  };
  let beforeQuitHandler: (() => void) | null = null;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "passbook-update-controller-"));
    autoUpdaterHandlers.clear();
    vi.clearAllMocks();
    stageDownloadedUpdate.mockReset();
    stageDownloadedUpdate.mockResolvedValue(undefined);
    beforeQuitHandler = null;
    electronApp = {
      on: vi.fn((event: string, handler: () => void) => {
        if (event === "before-quit") beforeQuitHandler = handler;
      }),
      removeListener: vi.fn(),
    };
    const { clearUpdateInstallQuitPending } =
      await import("../electron/update-install-quit.js");
    clearUpdateInstallQuitPending();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              result: {
                data: {
                  id: "backup-1",
                  verification: { status: "verified" },
                },
              },
            }),
        }),
      ),
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(dataDir, { recursive: true, force: true });
  });

  async function createController(
    overrides: Partial<{
      currentVersion: string;
      preInstallPrepare: () => Promise<void>;
      isHostExternal: () => boolean;
      installStagingTimeoutMs: number;
      quitHandoffTimeoutMs: number;
      stageDownloadedUpdate: (
        timeoutMs?: number,
        downloadedVersion?: string,
      ) => Promise<void>;
      onInstallFailureRecover: () => Promise<void>;
    }> = {},
  ) {
    const { UpdateController } =
      await import("../electron/update-controller.js");
    const controller = new UpdateController({
      dataDir,
      hostUrl: "http://127.0.0.1:3847",
      currentVersion: overrides.currentVersion ?? "0.1.0",
      electronApp,
      installStagingTimeoutMs: overrides.installStagingTimeoutMs,
      quitHandoffTimeoutMs: overrides.quitHandoffTimeoutMs,
      stageDownloadedUpdate:
        overrides.stageDownloadedUpdate ?? stageDownloadedUpdate,
      preInstallPrepare: overrides.preInstallPrepare,
      isHostExternal: overrides.isHostExternal,
      onInstallFailureRecover: overrides.onInstallFailureRecover,
    });
    return controller;
  }

  it("exposes available updates without native dialogs", async () => {
    const controller = await createController();
    await controller.start();
    autoUpdaterHandlers.get("update-available")?.({
      version: "0.1.1",
      releaseNotes: ["Fix desktop packaging"],
    });

    expect(controller.getState()).toMatchObject({
      status: "available",
      availableVersion: "0.1.1",
      releaseNotes: [{ version: "0.1.1", items: ["Fix desktop packaging"] }],
    });
    expect(autoUpdater.channel).toBe("passbook");
    expect(autoUpdater.allowPrerelease).toBe(true);
    expect(autoUpdater.allowDowngrade).toBe(false);
    controller.dispose();
  });

  it("calls the data platform backup API with plain tRPC envelopes", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            result: {
              data: {
                id: "backup-1",
                verification: { status: "verified" },
              },
            },
          }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const controller = await createController();
    await controller.start();
    autoUpdaterHandlers.get("update-downloaded")?.({ version: "0.1.1" });
    await controller.installUpdate();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3847/api/data/trpc/backups.create",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    controller.dispose();
  });

  it("keeps trial off the renderer until restart on the target version", async () => {
    const prepare = vi.fn(() => Promise.resolve());
    const controller = await createController({ preInstallPrepare: prepare });

    await controller.start();
    autoUpdaterHandlers.get("update-downloaded")?.({ version: "0.1.1" });

    const result = await controller.installUpdate();
    expect(result.accepted).toBe(true);
    expect(stageDownloadedUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      prepare.mock.invocationCallOrder[0] ?? 0,
    );
    expect(prepare.mock.invocationCallOrder[0]).toBeLessThan(
      autoUpdater.quitAndInstall.mock.invocationCallOrder[0] ?? 0,
    );
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true);
    expect(isUpdateInstallQuitPending()).toBe(true);
    expect(controller.getState().trial).toBeNull();
    expect(controller.getState().status).toBe("installing");

    const raw = await readFile(join(dataDir, ".update/intent.json"), "utf8");
    expect(JSON.parse(raw)).toMatchObject({
      stage: "trial",
      backupId: "backup-1",
      targetVersion: "0.1.1",
    });
    controller.dispose();
  });

  it("resumes a trial update only on the target version", async () => {
    const updateDir = join(dataDir, ".update");
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(updateDir, { recursive: true });
    await writeFile(
      join(updateDir, "intent.json"),
      JSON.stringify({
        targetVersion: "0.1.1",
        previousVersion: "0.1.0",
        stage: "trial",
        backupId: "backup-1",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );

    const controller = await createController({ currentVersion: "0.1.1" });
    await controller.start();
    expect(controller.getState().trial).toMatchObject({
      status: "verifying",
      targetVersion: "0.1.1",
      backupId: "backup-1",
    });
    controller.dispose();
  });

  it("marks a relaunch on the old runtime as failed instead of verifying", async () => {
    const updateDir = join(dataDir, ".update");
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(updateDir, { recursive: true });
    await writeFile(
      join(updateDir, "intent.json"),
      JSON.stringify({
        targetVersion: "0.1.1",
        previousVersion: "0.1.0",
        stage: "trial",
        backupId: "backup-1",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );

    const controller = await createController({ currentVersion: "0.1.0" });
    await controller.start();
    expect(controller.getState().trial).toMatchObject({
      status: "failed",
      backupId: "backup-1",
    });
    controller.dispose();
  });

  it("rejects install without a downloaded package", async () => {
    const controller = await createController();
    await controller.start();
    autoUpdaterHandlers.get("update-available")?.({ version: "0.1.1" });

    const result = await controller.installUpdate();
    expect(result.accepted).toBe(false);
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("rejects download unless an update is available", async () => {
    const controller = await createController();
    await controller.start();
    autoUpdaterHandlers.get("update-downloaded")?.({ version: "0.1.1" });

    const result = await controller.downloadUpdate();
    expect(result.accepted).toBe(false);
    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("rejects update checks while a downloaded update is waiting to install", async () => {
    const controller = await createController();
    await controller.start();
    autoUpdater.checkForUpdates.mockClear();
    autoUpdaterHandlers.get("update-downloaded")?.({ version: "0.1.1" });

    const result = await controller.checkForUpdates();
    expect(result.accepted).toBe(false);
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("preserves downloaded identity when Squirrel emits update-available again", async () => {
    const controller = await createController();
    await controller.start();
    autoUpdaterHandlers.get("update-downloaded")?.({ version: "0.1.1" });
    autoUpdaterHandlers.get("update-available")?.({
      version: "0.1.2",
      releaseNotes: ["Should be ignored"],
    });

    expect(controller.getState()).toMatchObject({
      status: "downloaded",
      downloadedVersion: "0.1.1",
      availableVersion: "0.1.1",
    });
    controller.dispose();
  });

  it("uses the quit handoff watchdog instead of failing immediately", async () => {
    vi.useFakeTimers();
    const controller = await createController({
      quitHandoffTimeoutMs: 120_000,
      preInstallPrepare: vi.fn(() => Promise.resolve()),
    });
    await controller.start();
    autoUpdaterHandlers.get("update-downloaded")?.({ version: "0.1.1" });
    await controller.installUpdate();

    vi.advanceTimersByTime(5_000);
    expect(controller.getState().trial?.status).not.toBe("failed");

    await vi.advanceTimersByTimeAsync(120_000);
    await vi.waitFor(() => {
      expect(controller.getState().trial?.status).toBe("failed");
    });
    expect(controller.getState().trial).toMatchObject({
      status: "failed",
      backupId: "backup-1",
    });
    expect(isUpdateInstallQuitPending()).toBe(false);
    vi.useRealTimers();
    controller.dispose();
  });

  it("surfaces native stage errors without stopping the host early", async () => {
    const prepare = vi.fn(() => Promise.resolve());
    const controller = await createController({
      preInstallPrepare: prepare,
      stageDownloadedUpdate: vi.fn(() =>
        Promise.reject(new Error("Native update staging timed out.")),
      ),
    });
    await controller.start();
    autoUpdaterHandlers.get("update-downloaded")?.({ version: "0.1.1" });
    await controller.installUpdate();

    expect(prepare).not.toHaveBeenCalled();
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    expect(controller.getState().trial).toMatchObject({
      status: "failed",
      failureReason: "Native update staging timed out.",
      backupId: "backup-1",
    });

    const raw = await readFile(join(dataDir, ".update/intent.json"), "utf8");
    const intent = JSON.parse(raw) as { failureReason?: string };
    expect(intent.failureReason).toBe("Native update staging timed out.");
    controller.dispose();
  });

  it("records quit handoff updater errors as failed intents", async () => {
    const controller = await createController({
      preInstallPrepare: vi.fn(() => Promise.resolve()),
    });
    await controller.start();
    autoUpdaterHandlers.get("update-downloaded")?.({ version: "0.1.1" });
    await controller.installUpdate();

    autoUpdaterHandlers.get("error")?.(new Error("Quit handoff failed"));

    await Promise.resolve();
    await vi.waitFor(() => {
      expect(controller.getState().trial?.status).toBe("failed");
    });
    expect(controller.getState().trial).toMatchObject({
      failureReason: "Quit handoff failed",
    });
    expect(isUpdateInstallQuitPending()).toBe(false);
    controller.dispose();
  });

  it("cancels the quit handoff watchdog when the app begins quitting", async () => {
    vi.useFakeTimers();
    const controller = await createController({
      quitHandoffTimeoutMs: 120_000,
      preInstallPrepare: vi.fn(() => Promise.resolve()),
    });
    await controller.start();
    autoUpdaterHandlers.get("update-downloaded")?.({ version: "0.1.1" });
    await controller.installUpdate();

    beforeQuitHandler?.();
    vi.advanceTimersByTime(120_000);
    await Promise.resolve();
    expect(controller.getState().trial).toBeNull();
    vi.useRealTimers();
    controller.dispose();
  });

  it("refuses install when the host is external", async () => {
    const controller = await createController({
      isHostExternal: () => true,
    });
    await controller.start();
    autoUpdaterHandlers.get("update-downloaded")?.({ version: "0.1.1" });

    const result = await controller.installUpdate();
    expect(result.accepted).toBe(false);
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    expect(controller.getState().message).toContain("external data host");
    expect(controller.getState().status).toBe("downloaded");
    controller.dispose();
  });

  it("writes install lifecycle events to update history", async () => {
    const controller = await createController({
      preInstallPrepare: vi.fn(() => Promise.resolve()),
    });
    await controller.start();
    autoUpdaterHandlers.get("update-downloaded")?.({ version: "0.1.1" });
    await controller.installUpdate();

    const history = await readFile(
      join(dataDir, ".update-history.log"),
      "utf8",
    );
    expect(history).toContain('"stage":"native_stage"');
    expect(history).toContain('"stage":"quit_handoff"');
    controller.dispose();
  });

  it("requires platform readiness and exact version before commit", async () => {
    const fetchMock = mockFetchSequence([
      () =>
        new Response(JSON.stringify({ state: "ready", version: "0.1.0" }), {
          status: 200,
        }),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const updateDir = join(dataDir, ".update");
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(updateDir, { recursive: true });
    await writeFile(
      join(updateDir, "intent.json"),
      JSON.stringify({
        targetVersion: "0.1.1",
        previousVersion: "0.1.0",
        stage: "trial",
        backupId: "backup-1",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );

    const controller = await createController({ currentVersion: "0.1.1" });
    await controller.start();
    const result = await controller.commitTrial();
    expect(result).toMatchObject({
      accepted: true,
      completed: false,
      state: { trial: { status: "failed" } },
    });
    controller.dispose();
  });

  it("does not report commit success when platform readiness fails", async () => {
    const fetchMock = mockFetchSequence([
      () =>
        new Response(JSON.stringify({ state: "ready", version: "0.1.0" }), {
          status: 200,
        }),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const updateDir = join(dataDir, ".update");
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(updateDir, { recursive: true });
    await writeFile(
      join(updateDir, "intent.json"),
      JSON.stringify({
        targetVersion: "0.1.1",
        previousVersion: "0.1.0",
        stage: "trial",
        backupId: "backup-1",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );

    const controller = await createController({ currentVersion: "0.1.1" });
    await controller.start();
    const result = await controller.commitTrial();
    expect(result.completed).toBe(false);
    expect(result.state.trial?.status).toBe("failed");
    expect(result.state.trial?.failureReason).toContain(
      "Expected version 0.1.1",
    );
    controller.dispose();
  });

  it("recovers the host when prepare fails after shutdown begins", async () => {
    const recover = vi.fn(() => Promise.resolve());
    const controller = await createController({
      preInstallPrepare: vi.fn(() => {
        throw new Error("Host shutdown failed after stop.");
      }),
      onInstallFailureRecover: recover,
    });
    await controller.start();
    autoUpdaterHandlers.get("update-downloaded")?.({ version: "0.1.1" });
    await controller.installUpdate();
    expect(recover).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it("serializes concurrent install failure recovery", async () => {
    const { UpdateOrchestrator } =
      await import("../electron/update-orchestrator.js");
    const markFailedSpy = vi.spyOn(UpdateOrchestrator.prototype, "markFailed");

    vi.useFakeTimers();
    const controller = await createController({
      quitHandoffTimeoutMs: 120_000,
      preInstallPrepare: vi.fn(() => Promise.resolve()),
    });
    await controller.start();
    autoUpdaterHandlers.get("update-downloaded")?.({ version: "0.1.1" });
    await controller.installUpdate();

    autoUpdaterHandlers.get("error")?.(new Error("Quit handoff failed"));
    await vi.advanceTimersByTimeAsync(120_000);
    await vi.waitFor(() => {
      expect(markFailedSpy).toHaveBeenCalledTimes(1);
    });
    markFailedSpy.mockRestore();
    vi.useRealTimers();
    controller.dispose();
  });

  it("clears a failed backup checkpoint so the app can continue", async () => {
    const { UpdateOrchestrator } =
      await import("../electron/update-orchestrator.js");
    const orchestrator = new UpdateOrchestrator({ dataDir });
    await orchestrator.beginUpdate("0.1.1", "0.1.0");
    await orchestrator.markFailed(
      "Passbook could not create a verified backup before updating.",
    );

    const controller = await createController();
    await controller.start();
    expect(controller.getState().trial).toMatchObject({
      status: "failed",
      backupId: "",
    });

    await expect(controller.dismissTrialFailure()).resolves.toMatchObject({
      accepted: true,
      completed: true,
      state: { trial: null },
    });
    await expect(orchestrator.readIntent()).resolves.toBeNull();
    controller.dispose();
  });

  it("clears a failed post-update trial without deleting its backup", async () => {
    const { UpdateOrchestrator } =
      await import("../electron/update-orchestrator.js");
    const orchestrator = new UpdateOrchestrator({ dataDir });
    await orchestrator.beginUpdate("0.1.1", "0.1.0");
    await orchestrator.markBackupComplete("backup-1");
    await orchestrator.markFailed("Updated host did not become ready.");

    const controller = await createController({ currentVersion: "0.1.1" });
    await controller.start();
    expect(controller.getState().trial).toMatchObject({
      status: "failed",
      backupId: "backup-1",
    });

    await controller.dismissTrialFailure();
    await expect(orchestrator.readIntent()).resolves.toBeNull();
    controller.dispose();
  });
});
