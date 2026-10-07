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
  dialog: {
    showMessageBox: vi.fn(() => Promise.resolve({ response: 1 })),
    showErrorBox: vi.fn(),
  },
}));

vi.mock("electron-updater", () => ({
  autoUpdater,
}));

vi.mock("../electron/host-connectivity.js", () => ({
  isHostHealthy: vi.fn(() => Promise.resolve(true)),
}));

describe("setupAutoUpdater", () => {
  beforeEach(() => {
    autoUpdaterHandlers.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("registers update handlers when packaged", async () => {
    const { setupAutoUpdater } = await import("../electron/update-manager.js");
    await setupAutoUpdater({
      dataDir: "/tmp/passbook-update",
      hostUrl: "http://127.0.0.1:3847",
      previousVersion: "0.1.0.20260306.1",
    });

    expect(autoUpdater.autoDownload).toBe(false);
    expect(autoUpdater.on).toHaveBeenCalledWith(
      "update-available",
      expect.any(Function),
    );
    expect(autoUpdater.on).toHaveBeenCalledWith(
      "update-downloaded",
      expect.any(Function),
    );

    vi.advanceTimersByTime(15_000);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });
});
