/**
 * Passbook desktop update lifecycle integration harness.
 *
 * Proves production UpdateController + UpdateOrchestrator against a real bundled
 * passbook-host (HTTP API, backups.create, data persistence). Only the
 * electron-updater boundary is simulated (EventEmitter + deferred native staging
 * via exported stageDownloadedUpdate). This does not exercise Squirrel/macOS
 * binary replacement.
 *
 * Prerequisites (from repo root):
 *   pnpm --filter @passbook/desktop build:host
 * or:
 *   cd apps/passbook/host && PASSBOOK_BUNDLE_NATIVE_RUNTIME=1 node build.mjs
 *
 * The test builds the host bundle automatically when missing.
 */

import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { App } from "electron";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { BundledPassbookHost } from "./fixtures/update-lifecycle-host.js";
import { clearUpdateInstallQuitPending } from "../electron/update-install-quit.js";
import {
  buildUpdateArtifact,
  startUpdateFeedServer,
} from "./fixtures/update-feed-server.js";
import {
  BundledHostRegistry,
  createBundledHost,
  ensureHostBundle,
  freePort,
} from "./fixtures/update-lifecycle-host.js";

const PREVIOUS_VERSION = "0.1.0-lifecycle";
const TARGET_VERSION = "0.2.0-lifecycle";
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const lifecycle = vi.hoisted(() => ({
  feedBaseUrl: "",
  artifact: null as ReturnType<typeof buildUpdateArtifact> | null,
  stagingMode: "success",
  stagingRejectMessage: "Simulated native staging failed",
  stagingGate: null as null | {
    resolve: () => void;
    reject: (error: Error) => void;
  },
  eventLog: [] as string[],
}));

const autoUpdaterHandlers = vi.hoisted(
  () => new Map<string, (...args: unknown[]) => void>(),
);

const autoUpdater = vi.hoisted(() => ({
  autoDownload: true,
  autoInstallOnAppQuit: true,
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
  checkForUpdates: vi.fn(() => {
    lifecycle.eventLog.push("checkForUpdates");
    queueMicrotask(() => {
      const artifact = lifecycle.artifact;
      if (!artifact) return;
      autoUpdaterHandlers.get("update-available")?.({
        version: artifact.version,
        releaseNotes: ["Simulated release"],
      });
    });
    return Promise.resolve(null);
  }),
  downloadUpdate: vi.fn(async () => {
    lifecycle.eventLog.push("downloadUpdate");
    const response = await fetch(`${lifecycle.feedBaseUrl}/artifact`);
    if (!response.ok) {
      throw new Error(
        "Simulated updater could not fetch the release artifact.",
      );
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const artifact = lifecycle.artifact;
    if (!artifact) {
      throw new Error("Update feed artifact is not configured.");
    }
    const actualSha512 = createHash("sha512").update(bytes).digest("base64");
    if (actualSha512 !== artifact.sha512) {
      throw new Error("Downloaded update failed SHA512 validation.");
    }
    autoUpdaterHandlers.get("download-progress")?.({ percent: 50 });
    autoUpdaterHandlers.get("download-progress")?.({ percent: 100 });
    autoUpdaterHandlers.get("update-downloaded")?.({
      version: artifact.version,
    });
    return null;
  }),
  quitAndInstall: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    isPackaged: true,
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

vi.mock("../electron/auto-updater.js", () => ({
  autoUpdater,
  PASSBOOK_UPDATE_CHANNEL: "passbook",
  applyPassbookAutoUpdaterChannel: vi.fn(),
  resetNativeStageCache: vi.fn(),
  getNativeStagedDownloadVersion: vi.fn(() => null),
  markNativeStageCached: vi.fn(),
  parseNativeAutoUpdaterError: (...args: unknown[]) => {
    const first = args[0];
    if (first instanceof Error) return first;
    if (typeof first === "string" && first.length > 0) {
      return new Error(first);
    }
    return new Error("Native update staging failed.");
  },
  async stageDownloadedUpdate(
    _timeoutMs?: number,
    _downloadedVersion?: string,
  ) {
    lifecycle.eventLog.push("stageDownloadedUpdate:start");
    if (lifecycle.stagingMode === "reject") {
      lifecycle.eventLog.push("stageDownloadedUpdate:reject");
      throw new Error(lifecycle.stagingRejectMessage);
    }
    if (lifecycle.stagingMode === "defer") {
      await new Promise<void>((resolve, reject) => {
        lifecycle.stagingGate = {
          resolve: () => {
            lifecycle.eventLog.push("stageDownloadedUpdate:resolve");
            resolve();
          },
          reject,
        };
      });
    }
    lifecycle.eventLog.push("stageDownloadedUpdate:done");
  },
}));

async function dataTrpc<T>(
  baseUrl: string,
  path: string,
  input?: unknown,
): Promise<T> {
  const response =
    input === undefined
      ? await fetch(`${baseUrl}/api/data/trpc/${path}`)
      : await fetch(`${baseUrl}/api/data/trpc/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
  const body = (await response.json()) as {
    result?: { data: T };
    error?: { message?: string };
  };
  if (!response.ok || body.error || !body.result) {
    throw new Error(`${path} failed: ${JSON.stringify(body)}`);
  }
  return body.result.data;
}

async function productTrpc<T>(
  baseUrl: string,
  path: string,
  input?: unknown,
  asQuery = false,
): Promise<T> {
  let response: Response;
  if (input !== undefined && !asQuery) {
    response = await fetch(`${baseUrl}/api/trpc/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: input }),
    });
  } else if (input !== undefined) {
    response = await fetch(
      `${baseUrl}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`,
    );
  } else {
    response = await fetch(`${baseUrl}/api/trpc/${path}`);
  }
  const body = (await response.json()) as {
    result?: { data: { json: T } };
    error?: { message: string };
  };
  if (!body.result) {
    throw new Error(`${path} failed: ${JSON.stringify(body)}`);
  }
  return body.result.data.json;
}

async function waitForHealth(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = (await response.json()) as { status?: string };
  return response.ok && body.status === "ok";
}

async function seedFictionalHousehold(baseUrl: string) {
  await productTrpc(baseUrl, "setup.initialize", {
    householdName: "Lifecycle Test Household",
    people: ["Alex Example", "Jordan Example"],
  });
  const people = await productTrpc<{ id: string; name: string }[]>(
    baseUrl,
    "people.list",
  );
  const person = people[0];
  if (!person) throw new Error("Expected seeded person");
  const institution = await productTrpc<{ id: string }>(
    baseUrl,
    "institutions.create",
    { name: "Example Credit Union" },
  );
  const account = await productTrpc<{ id: string }>(
    baseUrl,
    "accounts.create",
    {
      institutionId: institution.id,
      displayName: "Lifecycle Chequing",
      accountType: "chequing",
      openedDate: "2026-01-01",
      ownerIds: [person.id],
    },
  );

  const form = new FormData();
  form.set(
    "file",
    new File([pdf], "lifecycle-statement.pdf", { type: "application/pdf" }),
  );
  const upload = await fetch(`${baseUrl}/api/data/upload/document`, {
    method: "POST",
    body: form,
  });
  expect(upload.status).toBe(201);
  const staged = (await upload.json()) as { token: string };
  const document = await productTrpc<{ fileId: string }>(
    baseUrl,
    "documents.create",
    {
      accountId: account.id,
      type: "statement",
      periodKey: "2026-01",
      file: staged.token,
    },
  );

  const fileResponse = await fetch(
    `${baseUrl}/api/data/files/${document.fileId}`,
  );
  expect(fileResponse.status).toBe(200);

  return {
    personName: person.name,
    accountId: account.id,
    fileId: document.fileId,
  };
}

describe(
  "update lifecycle integration (real host + simulated native updater)",
  { timeout: 180_000 },
  () => {
    let dataDir: string;
    let backupDir: string;
    let port: number;
    let host: BundledPassbookHost;
    let feed: Awaited<ReturnType<typeof startUpdateFeedServer>> | undefined;
    const controllers: { dispose: () => void }[] = [];
    const hostRegistry = new BundledHostRegistry();

    beforeAll(async () => {
      await ensureHostBundle();
    });

    afterAll(async () => {
      await hostRegistry.stopAll();
    });

    beforeEach(async () => {
      lifecycle.eventLog.length = 0;
      lifecycle.stagingMode = "success";
      lifecycle.stagingGate = null;
      lifecycle.artifact = buildUpdateArtifact(TARGET_VERSION);
      clearUpdateInstallQuitPending();
      autoUpdaterHandlers.clear();
      vi.clearAllMocks();

      dataDir = await mkdtemp(join(tmpdir(), "passbook-update-lifecycle-"));
      backupDir = join(dataDir, "backups");
      port = await freePort();

      feed = await startUpdateFeedServer(lifecycle.artifact);
      lifecycle.feedBaseUrl = feed.baseUrl;

      host = hostRegistry.track(
        createBundledHost({
          dataDir,
          backupDir,
          port,
          appVersion: PREVIOUS_VERSION,
        }),
      );
      host.start();
      await host.waitForHealth();
    });

    afterEach(async () => {
      for (const controller of controllers.splice(0).reverse()) {
        controller.dispose();
      }
      if (feed) {
        await feed.close();
        feed = undefined;
      }
      await hostRegistry.stopAll();
      await rm(dataDir, { recursive: true, force: true });
    });

    async function restartTrackedHost(next: BundledPassbookHost) {
      if (host.isRunning()) {
        await host.stop();
      }
      hostRegistry.untrack(host);
      host = hostRegistry.track(next);
      next.start();
      await next.waitForHealth();
    }

    async function createController(options: {
      currentVersion: string;
      preInstallPrepare?: () => Promise<void>;
      onInstallFailureRecover?: () => Promise<void>;
      installStagingTimeoutMs?: number;
      quitHandoffTimeoutMs?: number;
    }) {
      const { UpdateController } =
        await import("../electron/update-controller.js");
      const electronApp = {
        on: vi.fn((event: string, handler: () => void) => {
          if (event === "before-quit") {
            electronApp.beforeQuit = handler;
          }
          return electronApp;
        }),
        removeListener: vi.fn(() => electronApp),
        beforeQuit: null as (() => void) | null,
      };
      const controller = new UpdateController({
        dataDir,
        hostUrl: host.baseUrl,
        checkIntervalMs: 60 * 60 * 1000,
        electronApp: electronApp as unknown as Pick<
          App,
          "on" | "removeListener"
        >,
        ...options,
      });
      controllers.push(controller);
      return controller;
    }

    async function runDownloadedInstall(options: {
      currentVersion?: string;
      targetVersion?: string;
      preInstallPrepare: () => Promise<void>;
      onInstallFailureRecover?: () => Promise<void>;
      onQuitAndInstall?: () => Promise<void>;
    }) {
      const controller = await createController({
        currentVersion: options.currentVersion ?? PREVIOUS_VERSION,
        preInstallPrepare: async () => {
          lifecycle.eventLog.push("preInstallPrepare");
          await options.preInstallPrepare();
        },
        onInstallFailureRecover: options.onInstallFailureRecover,
        installStagingTimeoutMs: 5_000,
        quitHandoffTimeoutMs: 5_000,
      });
      await controller.start();

      await controller.checkForUpdates();
      await vi.waitFor(
        () => expect(controller.getState().status).toBe("available"),
        { timeout: 5_000 },
      );
      await controller.downloadUpdate();
      await vi.waitFor(
        () => expect(controller.getState().status).toBe("downloaded"),
        { timeout: 5_000 },
      );

      autoUpdater.quitAndInstall.mockImplementation(() => {
        lifecycle.eventLog.push("quitAndInstall");
        const handoff = options.onQuitAndInstall?.();
        if (handoff) {
          return handoff;
        }
        return undefined;
      });

      const result = await controller.installUpdate();
      if (options.onQuitAndInstall) {
        await vi.waitFor(() => {
          expect(lifecycle.eventLog).toContain("quitAndInstall");
        });
        await autoUpdater.quitAndInstall.mock.results.at(-1)?.value;
      }
      return { controller, result };
    }

    it("runs backup → native staging (host up) → host stop → trial → commit with surviving data", async () => {
      const seed = await seedFictionalHousehold(host.baseUrl);
      let prepareDuringStaging: boolean | null = null;

      const { controller: oldController, result } = await runDownloadedInstall({
        preInstallPrepare: async () => {
          prepareDuringStaging = lifecycle.stagingGate !== null;
          await host.stop();
        },
        onQuitAndInstall: async () => {
          await restartTrackedHost(
            createBundledHost({
              dataDir,
              backupDir,
              port,
              appVersion: TARGET_VERSION,
            }),
          );
        },
      });

      expect(result.accepted).toBe(true);
      expect(
        lifecycle.eventLog.indexOf("stageDownloadedUpdate:start"),
      ).toBeLessThan(lifecycle.eventLog.indexOf("preInstallPrepare"));
      expect(prepareDuringStaging).toBe(false);

      oldController.dispose();
      controllers.pop();

      const resumed = await createController({
        currentVersion: TARGET_VERSION,
      });
      await resumed.start();
      const trial = resumed.getState().trial;
      expect(trial).toMatchObject({
        status: "verifying",
        targetVersion: TARGET_VERSION,
      });
      const backupId = trial?.backupId;
      if (!backupId) throw new Error("Expected backup id on resumed trial");

      const commit = await resumed.commitTrial();
      expect(commit.completed).toBe(true);
      expect(commit.state.trial).toBeNull();

      const people = await productTrpc<{ name: string }[]>(
        host.baseUrl,
        "people.list",
      );
      expect(people[0]?.name).toBe(seed.personName);

      const fileAfter = await fetch(
        `${host.baseUrl}/api/data/files/${seed.fileId}`,
      );
      expect(fileAfter.status).toBe(200);
      expect(Buffer.from(await fileAfter.arrayBuffer())).toEqual(pdf);

      await expect(
        access(join(dataDir, ".update/intent.json")),
      ).rejects.toMatchObject({ code: "ENOENT" });

      const verification = await dataTrpc<{
        verification: { status: string };
      }>(host.baseUrl, "backups.verify", { id: backupId });
      expect(verification.verification.status).toBe("verified");
    });

    it("keeps the host running when simulated native staging fails before preInstallPrepare", async () => {
      await seedFictionalHousehold(host.baseUrl);
      lifecycle.stagingMode = "reject";

      const { controller, result } = await runDownloadedInstall({
        preInstallPrepare: async () => {
          lifecycle.eventLog.push("preInstallPrepare");
          await host.stop();
        },
      });

      expect(result.completed).toBe(false);
      expect(lifecycle.eventLog).not.toContain("preInstallPrepare");
      expect(await waitForHealth(host.baseUrl)).toBe(true);
      expect(controller.getState().trial).toMatchObject({
        status: "failed",
        failureReason: lifecycle.stagingRejectMessage,
      });
      controller.dispose();
    });

    it("keeps the host healthy while native staging is deferred", async () => {
      await seedFictionalHousehold(host.baseUrl);
      lifecycle.stagingMode = "defer";

      const controller = await createController({
        currentVersion: PREVIOUS_VERSION,
        preInstallPrepare: async () => {
          lifecycle.eventLog.push("preInstallPrepare");
          await host.stop();
        },
      });
      await controller.start();
      await controller.checkForUpdates();
      await vi.waitFor(
        () => expect(controller.getState().status).toBe("available"),
        { timeout: 5_000 },
      );
      await controller.downloadUpdate();
      await vi.waitFor(
        () => expect(controller.getState().status).toBe("downloaded"),
        { timeout: 5_000 },
      );

      const installPromise = controller.installUpdate();
      await vi.waitFor(() => {
        expect(lifecycle.eventLog).toContain("stageDownloadedUpdate:start");
      });
      expect(await waitForHealth(host.baseUrl)).toBe(true);
      lifecycle.stagingGate?.resolve();
      await installPromise;
      await vi.waitFor(() => {
        expect(lifecycle.eventLog).toContain("preInstallPrepare");
      });
      controller.dispose();
    });

    it("marks unchanged shell restart as failed trial", async () => {
      await seedFictionalHousehold(host.baseUrl);
      const { controller: first } = await runDownloadedInstall({
        preInstallPrepare: async () => {
          await host.stop();
        },
        onQuitAndInstall: async () => {
          host.start();
          await host.waitForHealth();
        },
      });
      first.dispose();
      controllers.pop();

      const relaunched = await createController({
        currentVersion: PREVIOUS_VERSION,
      });
      await relaunched.start();
      const trial = relaunched.getState().trial;
      expect(trial?.status).toBe("failed");
      expect(typeof trial?.backupId).toBe("string");
      relaunched.dispose();
    });

    it("fails commit when host version does not match target", async () => {
      await seedFictionalHousehold(host.baseUrl);
      const { controller: first } = await runDownloadedInstall({
        preInstallPrepare: async () => {
          await host.stop();
        },
        onQuitAndInstall: async () => {
          await restartTrackedHost(
            createBundledHost({
              dataDir,
              backupDir,
              port,
              appVersion: "9.9.9-wrong",
            }),
          );
        },
      });
      first.dispose();
      controllers.pop();

      const resumed = await createController({
        currentVersion: TARGET_VERSION,
      });
      await resumed.start();
      const commit = await resumed.commitTrial();
      expect(commit.completed).toBe(false);
      expect(commit.accepted).toBe(true);
      expect(resumed.getState().trial?.status).toBe("failed");
      resumed.dispose();
    });

    it("fails install when backups.create cannot write archives", async () => {
      await seedFictionalHousehold(host.baseUrl);
      await host.stop();
      await rm(backupDir, { recursive: true, force: true });
      await writeFile(backupDir, "not a backup directory");

      const backupBlockedHost = hostRegistry.track(
        createBundledHost({
          dataDir,
          backupDir,
          port,
          appVersion: PREVIOUS_VERSION,
        }),
      );
      backupBlockedHost.start();
      await expect(backupBlockedHost.waitForHealth()).rejects.toThrow(
        /Passbook host exited|did not become ready/,
      );
      await backupBlockedHost.stop();
      hostRegistry.untrack(backupBlockedHost);

      await rm(backupDir, { force: true });
      await mkdir(backupDir, { recursive: true });
      host.start();
      await host.waitForHealth();

      await rm(backupDir, { recursive: true, force: true });
      await writeFile(backupDir, "not a backup directory");

      const backupProbe = await fetch(
        `${host.baseUrl}/api/data/trpc/backups.create`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const backupBody = (await backupProbe.json()) as {
        result?: { data?: { id?: string; verification?: { status?: string } } };
        error?: { message?: string };
      };
      const backupFailed =
        Boolean(backupBody.error) ||
        backupBody.result?.data?.verification?.status !== "verified";
      expect(backupFailed).toBe(true);

      const { controller, result } = await runDownloadedInstall({
        preInstallPrepare: async () => {
          await host.stop();
        },
      });

      expect(result.accepted).toBe(true);
      expect(result.completed).toBe(false);
      expect(controller.getState().trial?.status).toBe("failed");
      expect(lifecycle.eventLog).not.toContain("stageDownloadedUpdate:start");
      expect(lifecycle.eventLog).not.toContain("preInstallPrepare");
      expect(await waitForHealth(host.baseUrl)).toBe(true);
      controller.dispose();
    });

    it("rejects corrupted download payloads at the simulated native boundary", async () => {
      feed?.setCorruptTransfer(true);
      const controller = await createController({
        currentVersion: PREVIOUS_VERSION,
      });
      await controller.start();
      await controller.checkForUpdates();
      await vi.waitFor(
        () => expect(controller.getState().status).toBe("available"),
        { timeout: 5_000 },
      );

      const download = await controller.downloadUpdate();
      expect(download.completed).toBe(false);
      expect(controller.getState().status).toBe("available");
      expect(controller.getState().errorContext).toBe("download");
      controller.dispose();
    });

    it("records quit-handoff updater errors, recovers the host, and clears quit pending", async () => {
      await seedFictionalHousehold(host.baseUrl);
      const recoverHost = vi.fn(async () => {
        lifecycle.eventLog.push("onInstallFailureRecover");
        host.start();
        await host.waitForHealth();
      });
      const { controller } = await runDownloadedInstall({
        preInstallPrepare: async () => {
          lifecycle.eventLog.push("preInstallPrepare");
          await host.stop();
        },
        onInstallFailureRecover: recoverHost,
      });

      autoUpdaterHandlers.get("error")?.(
        new Error("Simulated quit-handoff staging failed"),
      );
      await vi.waitFor(() => {
        expect(controller.getState().trial?.status).toBe("failed");
      });
      expect(lifecycle.eventLog).toContain("preInstallPrepare");
      expect(recoverHost).toHaveBeenCalledTimes(1);
      expect(await waitForHealth(host.baseUrl)).toBe(true);
      const { isUpdateInstallQuitPending } =
        await import("../electron/update-install-quit.js");
      expect(isUpdateInstallQuitPending()).toBe(false);
      controller.dispose();
    });
  },
);
