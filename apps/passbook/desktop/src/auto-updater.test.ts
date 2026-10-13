import type * as NodeModuleApi from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NativeAutoUpdaterLike } from "../electron/auto-updater.js";
import {
  applyPassbookAutoUpdaterChannel,
  parseNativeAutoUpdaterError,
  resetNativeStageCache,
  stageDownloadedUpdate,
} from "../electron/auto-updater.js";

vi.mock("electron", () => ({
  autoUpdater: {
    once: vi.fn(),
    removeListener: vi.fn(),
    checkForUpdates: vi.fn(),
  },
}));

vi.mock("node:module", async (importOriginal) => {
  const actual = await importOriginal<typeof NodeModuleApi>();
  return {
    ...actual,
    createRequire: () => {
      const requireFn = ((id: string) => {
        if (id === "electron-updater") {
          return { autoUpdater: {} };
        }
        throw new Error(`Unexpected test require: ${id}`);
      }) as NodeRequire;
      return Object.assign(requireFn, { resolve: () => "" });
    },
  };
});

type NativeHandler = (...args: unknown[]) => void;

function createMockNativeAutoUpdater(options?: {
  checkForUpdates?: () => void;
}) {
  const onceHandlers = new Map<string, NativeHandler>();
  const removeListener = vi.fn((event: string, listener: NativeHandler) => {
    if (onceHandlers.get(event) === listener) {
      onceHandlers.delete(event);
    }
  });

  const native: NativeAutoUpdaterLike & {
    emit: (event: string, ...args: unknown[]) => void;
    hasListener: (event: string) => boolean;
  } = {
    once: (event, listener) => {
      onceHandlers.set(event, listener);
    },
    removeListener,
    checkForUpdates: options?.checkForUpdates ?? (() => undefined),
    emit: (event, ...args) => {
      onceHandlers.get(event)?.(...args);
    },
    hasListener: (event) => onceHandlers.has(event),
  };

  return native;
}

describe("applyPassbookAutoUpdaterChannel", () => {
  it("sets the passbook channel and disables downgrade after channel assignment", () => {
    const target = {
      _channel: null as string | null,
      allowPrerelease: false,
      allowDowngrade: false,
    };
    Object.defineProperty(target, "channel", {
      get: () => target._channel,
      set: (value: string | null) => {
        target._channel = value;
        target.allowDowngrade = true;
      },
    });

    applyPassbookAutoUpdaterChannel(
      target as unknown as {
        channel: string | null;
        allowPrerelease: boolean;
        allowDowngrade: boolean;
      },
    );

    expect(target._channel).toBe("passbook");
    expect(target.allowPrerelease).toBe(true);
    expect(target.allowDowngrade).toBe(false);
  });
});

describe("parseNativeAutoUpdaterError", () => {
  it("preserves a single Error argument from native autoUpdater", () => {
    const error = new Error("Code signature verification failed.");
    expect(parseNativeAutoUpdaterError(error)).toBe(error);
  });

  it("supports legacy event plus error arguments", () => {
    const error = new Error("Legacy native error");
    expect(parseNativeAutoUpdaterError({}, error)).toEqual(error);
  });
});

describe("stageDownloadedUpdate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after a delayed native update-downloaded event", async () => {
    const native = createMockNativeAutoUpdater({
      checkForUpdates: () => {
        setTimeout(() => native.emit("update-downloaded"), 6_000);
      },
    });

    const promise = stageDownloadedUpdate(120_000, {
      nativeAutoUpdater: native,
      platform: "darwin",
    });

    await vi.advanceTimersByTimeAsync(6_000);
    await expect(promise).resolves.toBeUndefined();
    expect(native.hasListener("update-downloaded")).toBe(false);
    expect(native.hasListener("error")).toBe(false);
  });

  it("rejects with the native signing error from a single Error argument", async () => {
    const native = createMockNativeAutoUpdater({
      checkForUpdates: () => {
        native.emit("error", new Error("Code signature verification failed."));
      },
    });

    await expect(
      stageDownloadedUpdate(120_000, {
        nativeAutoUpdater: native,
        platform: "darwin",
      }),
    ).rejects.toThrow("Code signature verification failed.");
    expect(native.removeListener).toHaveBeenCalled();
  });

  it("cleans listeners and timer when checkForUpdates throws synchronously", async () => {
    const native = createMockNativeAutoUpdater({
      checkForUpdates: () => {
        throw new Error("Feed URL is missing.");
      },
    });

    await expect(
      stageDownloadedUpdate(120_000, {
        nativeAutoUpdater: native,
        platform: "darwin",
      }),
    ).rejects.toThrow("Feed URL is missing.");

    expect(native.hasListener("update-downloaded")).toBe(false);
    expect(native.hasListener("error")).toBe(false);

    native.emit("update-downloaded");
    native.emit("error", new Error("late error"));
    await vi.advanceTimersByTimeAsync(120_000);
  });

  it("times out and cleans listeners when native staging never completes", async () => {
    const native = createMockNativeAutoUpdater();

    const promise = stageDownloadedUpdate(120_000, {
      nativeAutoUpdater: native,
      platform: "darwin",
    });
    const rejection = expect(promise).rejects.toThrow(
      "Native update staging timed out.",
    );

    await vi.advanceTimersByTimeAsync(120_000);
    await rejection;
    expect(native.hasListener("update-downloaded")).toBe(false);
    expect(native.hasListener("error")).toBe(false);
  });

  it("reuses native stage cache for the same downloaded version", async () => {
    resetNativeStageCache();
    let checkCalls = 0;
    const native = createMockNativeAutoUpdater({
      checkForUpdates: () => {
        checkCalls += 1;
        native.emit("update-downloaded");
      },
    });

    await stageDownloadedUpdate(
      120_000,
      { nativeAutoUpdater: native, platform: "darwin" },
      "0.1.1",
    );
    await stageDownloadedUpdate(
      120_000,
      { nativeAutoUpdater: native, platform: "darwin" },
      "0.1.1",
    );

    expect(checkCalls).toBe(1);
  });

  it("retries after successful staging without calling native checkForUpdates again", async () => {
    resetNativeStageCache();
    let checkCalls = 0;
    const native = createMockNativeAutoUpdater({
      checkForUpdates: () => {
        checkCalls += 1;
        native.emit("update-downloaded");
      },
    });

    await stageDownloadedUpdate(
      120_000,
      { nativeAutoUpdater: native, platform: "darwin" },
      "0.1.1",
    );

    await stageDownloadedUpdate(
      120_000,
      { nativeAutoUpdater: native, platform: "darwin" },
      "0.1.1",
    );

    expect(checkCalls).toBe(1);
  });

  it("requires native staging again after cache reset for a new zip version", async () => {
    resetNativeStageCache();
    let checkCalls = 0;
    const native = createMockNativeAutoUpdater({
      checkForUpdates: () => {
        checkCalls += 1;
        native.emit("update-downloaded");
      },
    });

    await stageDownloadedUpdate(
      120_000,
      { nativeAutoUpdater: native, platform: "darwin" },
      "0.1.1",
    );
    resetNativeStageCache();
    await stageDownloadedUpdate(
      120_000,
      { nativeAutoUpdater: native, platform: "darwin" },
      "0.1.2",
    );

    expect(checkCalls).toBe(2);
  });

  it("no-ops on non-darwin platforms", async () => {
    const native = createMockNativeAutoUpdater({
      checkForUpdates: () => {
        throw new Error("Should not run.");
      },
    });

    await expect(
      stageDownloadedUpdate(120_000, {
        nativeAutoUpdater: native,
        platform: "linux",
      }),
    ).resolves.toBeUndefined();
  });
});
