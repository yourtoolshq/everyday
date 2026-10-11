import { beforeEach, describe, expect, it, vi } from "vitest";

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
  checkForUpdates: vi.fn(() => Promise.resolve(null)),
  downloadUpdate: vi.fn(() => Promise.resolve(null)),
  quitAndInstall: vi.fn(),
};

vi.mock("electron", () => ({
  app: {
    isPackaged: true,
    on: vi.fn(),
    removeListener: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock("../electron/auto-updater.js", () => ({
  autoUpdater,
  stageDownloadedUpdate: vi.fn(() => Promise.resolve()),
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

describe("setupAutoUpdater", () => {
  beforeEach(() => {
    autoUpdaterHandlers.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("registers IPC handlers and update listeners when packaged", async () => {
    const { setupAutoUpdater } = await import("../electron/update-manager.js");
    const controller = await setupAutoUpdater({
      dataDir: "/tmp/passbook-update",
      hostUrl: "http://127.0.0.1:3847",
      previousVersion: "0.1.0.20260306.1",
    });

    expect(controller).not.toBeNull();
    expect(autoUpdater.autoDownload).toBe(false);
    expect(autoUpdater.channel).toBe("passbook");
    expect(autoUpdater.allowPrerelease).toBe(true);
    expect(autoUpdater.allowDowngrade).toBe(false);
    expect(autoUpdater.on).toHaveBeenCalledWith(
      "update-available",
      expect.any(Function),
    );
    expect(autoUpdater.on).toHaveBeenCalledWith(
      "update-downloaded",
      expect.any(Function),
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });
});
