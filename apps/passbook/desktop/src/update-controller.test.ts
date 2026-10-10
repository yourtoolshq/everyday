import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isUpdateInstallQuitPending } from "../electron/update-install-quit.js";

const autoUpdaterHandlers = new Map<string, (...args: unknown[]) => void>();
const autoUpdater = {
  autoDownload: true,
  autoInstallOnAppQuit: true,
  on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
    autoUpdaterHandlers.set(event, listener);
  }),
  checkForUpdates: vi.fn(() => Promise.resolve(null)),
  downloadUpdate: vi.fn(() => Promise.resolve(null)),
  quitAndInstall: vi.fn(),
};

vi.mock("../electron/auto-updater.js", () => ({
  autoUpdater,
}));

describe("UpdateController", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "passbook-update-controller-"));
    autoUpdaterHandlers.clear();
    vi.clearAllMocks();
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

  it("exposes available updates without native dialogs", async () => {
    const { UpdateController } =
      await import("../electron/update-controller.js");
    const controller = new UpdateController({
      dataDir,
      hostUrl: "http://127.0.0.1:3847",
      currentVersion: "0.1.0",
    });

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

    const { UpdateController } =
      await import("../electron/update-controller.js");
    const controller = new UpdateController({
      dataDir,
      hostUrl: "http://127.0.0.1:3847",
      currentVersion: "0.1.0",
    });

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
  });

  it("leaves the update in trial stage before restart", async () => {
    const { UpdateController } =
      await import("../electron/update-controller.js");
    const controller = new UpdateController({
      dataDir,
      hostUrl: "http://127.0.0.1:3847",
      currentVersion: "0.1.0",
    });

    await controller.start();
    autoUpdaterHandlers.get("update-downloaded")?.({ version: "0.1.1" });

    const result = await controller.installUpdate();
    expect(result.accepted).toBe(true);
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true);
    expect(isUpdateInstallQuitPending()).toBe(true);
    expect(controller.getState().trial).toMatchObject({
      status: "verifying",
      backupId: "backup-1",
    });

    const raw = await readFile(join(dataDir, ".update/intent.json"), "utf8");
    expect(JSON.parse(raw)).toMatchObject({
      stage: "trial",
      backupId: "backup-1",
      targetVersion: "0.1.1",
    });
  });

  it("resumes a trial update for renderer verification", async () => {
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

    const { UpdateController } =
      await import("../electron/update-controller.js");
    const controller = new UpdateController({
      dataDir,
      hostUrl: "http://127.0.0.1:3847",
      currentVersion: "0.1.1",
    });

    await controller.start();
    expect(controller.getState().trial).toMatchObject({
      status: "verifying",
      targetVersion: "0.1.1",
      backupId: "backup-1",
    });
  });

  it("clears a failed backup checkpoint so the app can continue", async () => {
    const { UpdateOrchestrator } =
      await import("../electron/update-orchestrator.js");
    const orchestrator = new UpdateOrchestrator({ dataDir });
    await orchestrator.beginUpdate("0.1.1", "0.1.0");
    await orchestrator.markFailed(
      "Passbook could not create a verified backup before updating.",
    );

    const { UpdateController } =
      await import("../electron/update-controller.js");
    const controller = new UpdateController({
      dataDir,
      hostUrl: "http://127.0.0.1:3847",
      currentVersion: "0.1.0",
    });

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
  });

  it("clears a failed post-update trial without deleting its backup", async () => {
    const { UpdateOrchestrator } =
      await import("../electron/update-orchestrator.js");
    const orchestrator = new UpdateOrchestrator({ dataDir });
    await orchestrator.beginUpdate("0.1.1", "0.1.0");
    await orchestrator.markBackupComplete("backup-1");
    await orchestrator.markFailed("Updated host did not become ready.");

    const { UpdateController } =
      await import("../electron/update-controller.js");
    const controller = new UpdateController({
      dataDir,
      hostUrl: "http://127.0.0.1:3847",
      currentVersion: "0.1.1",
    });

    await controller.start();
    expect(controller.getState().trial).toMatchObject({
      status: "failed",
      backupId: "backup-1",
    });

    await controller.dismissTrialFailure();
    await expect(orchestrator.readIntent()).resolves.toBeNull();
  });
});
