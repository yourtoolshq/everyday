import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("electron", () => ({
  app: { isPackaged: true },
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock("../electron/auto-updater.js", () => ({
  autoUpdater,
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
