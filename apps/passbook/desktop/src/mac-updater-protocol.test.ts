import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import nodeModule, { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import type * as NodeModuleApi from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getNativeStagedDownloadVersion,
  resetNativeStageCache,
  stageDownloadedUpdate,
} from "../electron/auto-updater.js";

const nativeHolder = vi.hoisted(() => ({
  current: null as NativeAutoUpdaterSimulator | null,
}));

vi.mock("electron", () => ({
  autoUpdater: {}, // Staging uses the explicitly injected simulator below.
}));

vi.mock("node:module", async (importOriginal) => {
  const actual = await importOriginal<typeof NodeModuleApi>();
  return {
    ...actual,
    createRequire: (filename: string | URL) => {
      const realRequire = actual.createRequire(filename);
      return new Proxy(realRequire, {
        apply(target, thisArg, args: [string]) {
          // Only isolate the production singleton; the installed MacUpdater
          // implementation is loaded through its actual module path below.
          if (args[0] === "electron-updater") return { autoUpdater: {} };
          return Reflect.apply(target, thisArg, args) as unknown;
        },
      });
    },
  };
});

const moduleLoader = nodeModule as unknown as {
  _load: (
    request: string,
    parent: NodeModule | undefined,
    isMain: boolean,
  ) => unknown;
};
const originalModuleLoad = moduleLoader._load;

function installCjsElectronBoundary(native: NativeAutoUpdaterSimulator) {
  nativeHolder.current = native;
  moduleLoader._load = function patchedLoad(
    request: string,
    parent: NodeModule | undefined,
    isMain: boolean,
  ) {
    if (request === "electron" && nativeHolder.current) {
      return { autoUpdater: nativeHolder.current };
    }
    return originalModuleLoad.call(this, request, parent, isMain);
  };
}

function restoreCjsElectronBoundary() {
  nativeHolder.current = null;
  moduleLoader._load = originalModuleLoad;
}

interface MacUpdaterInstance {
  logger: unknown;
  autoInstallOnAppQuit: boolean;
  autoRunAppAfterInstall: boolean;
  nativeUpdater: NativeAutoUpdaterSimulator;
  server?: { close: (cb?: (err?: Error) => void) => void; listening?: boolean };
  updateDownloaded: (
    zipFileInfo: { url: URL; info: { size?: number } },
    event: { downloadedFile: string; version?: string },
  ) => Promise<unknown>;
  quitAndInstall: () => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  once: (event: string, listener: (...args: unknown[]) => void) => void;
  removeAllListeners: (event?: string) => void;
  closeServerIfExists: () => void;
}

class NativeAutoUpdaterSimulator extends EventEmitter {
  checkForUpdatesCalls = 0;
  quitAndInstallCalls = 0;
  feed: { url: string; headers: Record<string, string> } | null = null;
  checkForUpdatesMode: "proxy" | "signing-error" = "proxy";

  setFeedURL(options: { url: string; headers?: Record<string, string> }) {
    this.feed = {
      url: options.url,
      headers: options.headers ?? {},
    };
  }

  quitAndInstall() {
    this.quitAndInstallCalls += 1;
  }

  checkForUpdates() {
    this.checkForUpdatesCalls += 1;
    void this.simulateSquirrelMacFetch();
  }

  private async simulateSquirrelMacFetch() {
    if (this.checkForUpdatesMode === "signing-error") {
      this.emit("error", new Error("Code signature verification failed."));
      return;
    }

    const feed = this.feed;
    if (!feed) {
      this.emit("error", new Error("Feed URL is missing."));
      return;
    }

    try {
      const feedResponse = await fetch(feed.url, {
        headers: feed.headers,
      });
      if (!feedResponse.ok) {
        throw new Error(`Feed request failed: ${feedResponse.status}`);
      }
      const body = (await feedResponse.json()) as { url?: string };
      if (!body.url) {
        throw new Error("Feed response did not include a zip URL.");
      }

      const zipResponse = await fetch(body.url);
      if (!zipResponse.ok) {
        throw new Error(`Zip request failed: ${zipResponse.status}`);
      }
      await zipResponse.arrayBuffer();
      this.emit("update-downloaded");
    } catch (error) {
      this.emit(
        "error",
        error instanceof Error
          ? error
          : new Error("Native Squirrel fetch failed."),
      );
    }
  }
}

const require = createRequire(import.meta.url);
const requireFromUpdater = createRequire(
  require.resolve("electron-updater/package.json"),
);

function loadMacUpdaterConstructor(): new (
  options: null,
  app: {
    version: string;
    name: string;
    isPackaged: boolean;
    appUpdateConfigPath: string;
    userDataPath: string;
    baseCachePath: string;
    whenReady: () => Promise<void>;
    relaunch: () => void;
    quit: () => void;
    onQuit: (handler: (exitCode: number) => void) => void;
  },
) => MacUpdaterInstance {
  const macUpdaterPath = requireFromUpdater.resolve("./out/MacUpdater");
  delete requireFromUpdater.cache[macUpdaterPath];
  const { MacUpdater } = requireFromUpdater("./out/MacUpdater") as {
    MacUpdater: new (
      options: null,
      app: {
        version: string;
        name: string;
        isPackaged: boolean;
        appUpdateConfigPath: string;
        userDataPath: string;
        baseCachePath: string;
        whenReady: () => Promise<void>;
        relaunch: () => void;
        quit: () => void;
        onQuit: (handler: (exitCode: number) => void) => void;
      },
    ) => MacUpdaterInstance;
  };
  return MacUpdater;
}

const UPDATE_VERSION = "0.2.0-passbook.20260101.9";
const ZIP_BYTES = Buffer.from(
  "PK\x03\x04passbook-mac-updater-protocol-fixture",
);

async function createFixtureLayout() {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "passbook-mac-updater-"),
  );
  const zipPath = path.join(root, "update.zip");
  await fs.writeFile(zipPath, ZIP_BYTES);
  return { root, zipPath };
}

function createTestApp(root: string, quit: () => void) {
  return {
    version: "0.1.0",
    name: "Passbook",
    isPackaged: true,
    appUpdateConfigPath: path.join(root, "app-update.yml"),
    userDataPath: path.join(root, "user-data"),
    baseCachePath: path.join(root, "cache"),
    whenReady: () => Promise.resolve(),
    relaunch: () => undefined,
    quit,
    onQuit: () => undefined,
  };
}

function waitForEvent(emitter: EventEmitter, event: string) {
  return new Promise<unknown[]>((resolve) => {
    emitter.once(event, (...args: unknown[]) => resolve(args));
  });
}

function waitForServerClose(
  macUpdater: MacUpdaterInstance,
  timeoutMs = 10_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = macUpdater.server;
    if (!server?.listening) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      reject(
        new Error("Timed out waiting for Squirrel proxy server to close."),
      );
    }, timeoutMs);

    server.close(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

describe("MacUpdater Squirrel protocol (electron-updater 6.8.9)", () => {
  let native: NativeAutoUpdaterSimulator;
  let fixtureRoot: string;
  let zipPath: string;
  let appQuit: ReturnType<typeof vi.fn>;
  let macUpdater: MacUpdaterInstance;

  beforeEach(async () => {
    native = new NativeAutoUpdaterSimulator();
    native.checkForUpdatesMode = "proxy";
    installCjsElectronBoundary(native);

    const fixture = await createFixtureLayout();
    fixtureRoot = fixture.root;
    zipPath = fixture.zipPath;
    appQuit = vi.fn();

    const MacUpdater = loadMacUpdaterConstructor();
    macUpdater = new MacUpdater(null, createTestApp(fixtureRoot, appQuit));
    macUpdater.autoInstallOnAppQuit = false;
    macUpdater.autoRunAppAfterInstall = true;
    macUpdater.logger = null;
  });

  afterEach(async () => {
    try {
      macUpdater.removeAllListeners();
      macUpdater.closeServerIfExists();
      native.removeAllListeners();
    } finally {
      restoreCjsElectronBoundary();
      if (fixtureRoot) {
        await fs.rm(fixtureRoot, { recursive: true, force: true });
      }
    }
  });

  it("emits outer update-downloaded without native check or quit when autoInstallOnAppQuit is false", async () => {
    const zipFileInfo = {
      url: new URL("https://releases.example/passbook-update.zip"),
      info: { size: ZIP_BYTES.length },
    };
    const downloadedEvent = {
      downloadedFile: zipPath,
      version: UPDATE_VERSION,
    };

    const outerDownloaded = waitForEvent(
      macUpdater as unknown as EventEmitter,
      "update-downloaded",
    );

    await macUpdater.updateDownloaded(zipFileInfo, downloadedEvent);
    const [outerPayload] = await outerDownloaded;

    expect(outerPayload).toMatchObject({
      downloadedFile: zipPath,
      version: UPDATE_VERSION,
    });
    expect(native.checkForUpdatesCalls).toBe(0);
    expect(native.quitAndInstallCalls).toBe(0);
    expect(appQuit).not.toHaveBeenCalled();
    expect(native.feed?.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(native.feed?.headers.Authorization).toMatch(/^Basic /);
  });

  it("stages through the Squirrel proxy then quitAndInstall calls native quit once and closes the server", async () => {
    resetNativeStageCache();

    const zipFileInfo = {
      url: new URL("https://releases.example/passbook-update.zip"),
      info: { size: ZIP_BYTES.length },
    };
    const downloadedEvent = {
      downloadedFile: zipPath,
      version: UPDATE_VERSION,
    };

    await macUpdater.updateDownloaded(zipFileInfo, downloadedEvent);
    expect(native.checkForUpdatesCalls).toBe(0);
    expect(appQuit).not.toHaveBeenCalled();

    const staging = stageDownloadedUpdate(
      30_000,
      { nativeAutoUpdater: native, platform: "darwin" },
      UPDATE_VERSION,
    );

    await expect(staging).resolves.toBeUndefined();
    expect(native.checkForUpdatesCalls).toBe(1);
    expect(getNativeStagedDownloadVersion()).toBe(UPDATE_VERSION);
    expect(native.quitAndInstallCalls).toBe(0);
    expect(appQuit).not.toHaveBeenCalled();

    macUpdater.quitAndInstall();

    expect(native.quitAndInstallCalls).toBe(1);
    expect(appQuit).not.toHaveBeenCalled();
    await waitForServerClose(macUpdater);
  });

  it("propagates native signing errors from staging without calling native quitAndInstall", async () => {
    resetNativeStageCache();
    native.checkForUpdatesMode = "signing-error";

    const zipFileInfo = {
      url: new URL("https://releases.example/passbook-update.zip"),
      info: { size: ZIP_BYTES.length },
    };

    await macUpdater.updateDownloaded(zipFileInfo, {
      downloadedFile: zipPath,
      version: UPDATE_VERSION,
    });

    await expect(
      stageDownloadedUpdate(
        30_000,
        { nativeAutoUpdater: native, platform: "darwin" },
        UPDATE_VERSION,
      ),
    ).rejects.toThrow("Code signature verification failed.");

    expect(native.checkForUpdatesCalls).toBe(1);
    expect(native.quitAndInstallCalls).toBe(0);
    expect(appQuit).not.toHaveBeenCalled();

    macUpdater.quitAndInstall();
    expect(native.checkForUpdatesCalls).toBe(2);
    expect(native.quitAndInstallCalls).toBe(0);
  });
});
