import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveDesktopPaths } from "../../electron/config.js";
import { HostProcess } from "../../electron/host-process.js";

const passbookRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const hostBundle = join(passbookRoot, "host", "dist", "passbook-host.cjs");

export { passbookRoot, hostBundle };

export async function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a loopback port"));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

export async function ensureHostBundle() {
  try {
    await access(hostBundle);
    return hostBundle;
  } catch {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("node", ["build.mjs"], {
        cwd: join(passbookRoot, "host"),
        env: {
          ...process.env,
          PASSBOOK_BUNDLE_NATIVE_RUNTIME: "1",
        },
        stdio: "inherit",
      });
      child.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`host build.mjs failed (${code})`)),
      );
    });
    await access(hostBundle);
    return hostBundle;
  }
}

export interface TempHostEnv {
  dataDir: string;
  backupDir: string;
  port: number;
  appVersion: string;
}

export function buildHostEnv(options: TempHostEnv) {
  return {
    PASSBOOK_PACKAGED: "1",
    PASSBOOK_ROOT: passbookRoot,
    PASSBOOK_USE_BUNDLED_HOST: "1",
    DATA_DIR: options.dataDir,
    BACKUP_DIR: options.backupDir,
    HOST: "127.0.0.1",
    PORT: String(options.port),
    APP_VERSION: options.appVersion,
    NODE_ENV: "test",
  };
}

export class BundledPassbookHost {
  private readonly host: HostProcess;
  readonly baseUrl: string;

  constructor(
    private readonly env: Record<string, string>,
    port: number,
  ) {
    const paths = resolveDesktopPaths(env);
    this.baseUrl = `http://${paths.host}:${port}`;
    this.host = new HostProcess({
      command: paths.hostCommand,
      args: paths.hostArgs,
      cwd: paths.hostCwd,
      env,
    });
  }

  start() {
    this.host.start();
  }

  waitForHealth(timeoutMs = 60_000) {
    return this.host.waitForHealth(this.baseUrl, timeoutMs);
  }

  stop() {
    return this.host.stop();
  }

  isRunning() {
    return this.host.isRunning();
  }

  getRecentStderr() {
    return this.host.getRecentStderr();
  }

  withAppVersion(appVersion: string) {
    return new BundledPassbookHost(
      { ...this.env, APP_VERSION: appVersion },
      Number(this.env.PORT),
    );
  }
}

export function createBundledHost(options: TempHostEnv) {
  const env = buildHostEnv(options);
  return new BundledPassbookHost(env, options.port);
}

/** Tracks every bundled host subprocess so integration tests can stop them all. */
export class BundledHostRegistry {
  private readonly hosts = new Set<BundledPassbookHost>();

  track(host: BundledPassbookHost) {
    this.hosts.add(host);
    return host;
  }

  untrack(host: BundledPassbookHost) {
    this.hosts.delete(host);
  }

  async stopAll() {
    const stops = [...this.hosts].map(async (host) => {
      if (host.isRunning()) {
        await host.stop();
      }
    });
    await Promise.allSettled(stops);
    this.hosts.clear();
  }
}
