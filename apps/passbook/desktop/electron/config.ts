import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const passbookRoot = path.resolve(desktopRoot, "..");

export interface DesktopPaths {
  root: string;
  dataDir: string;
  backupDir: string;
  host: string;
  port: string;
  hostUrl: string;
  clientDevUrl: string;
  clientDist: string;
  hostEntry: string;
  hostCwd: string;
  hostCommand: string;
  hostArgs: string[];
  appVersion: string;
}

export function resolveDesktopPaths(
  env: NodeJS.ProcessEnv = process.env,
): DesktopPaths {
  const packaged = env.PASSBOOK_PACKAGED === "1";
  const root = packaged && env.PASSBOOK_ROOT ? env.PASSBOOK_ROOT : passbookRoot;
  const dataDir =
    env.DATA_DIR ??
    (packaged && env.PASSBOOK_USER_DATA_DIR
      ? path.join(env.PASSBOOK_USER_DATA_DIR, "data")
      : path.join(passbookRoot, ".data", "desktop-test"));
  // Desktop data and backups must be separate folders. Keeping archives under
  // the data folder makes a damaged or accidentally removed data folder take
  // every recovery point with it.
  const backupDir =
    env.BACKUP_DIR ??
    (packaged && env.PASSBOOK_USER_DATA_DIR
      ? path.join(env.PASSBOOK_USER_DATA_DIR, "backups")
      : path.join(dataDir, "backups"));
  const host = env.HOST ?? "127.0.0.1";
  const port = env.PORT ?? "3847";
  const hostUrl = `http://${host}:${port}`;
  const clientDevUrl = env.PASSBOOK_CLIENT_DEV_URL ?? "http://127.0.0.1:5173";
  const clientDist =
    env.PASSBOOK_CLIENT_DIST ??
    (packaged
      ? path.join(root, "client")
      : path.join(passbookRoot, "client", "dist"));
  const useBundledHost = packaged || env.PASSBOOK_USE_BUNDLED_HOST === "1";
  const hostEntry =
    env.PASSBOOK_HOST_ENTRY ??
    (useBundledHost
      ? path.join(root, "host", "dist", "passbook-host.cjs")
      : path.join(passbookRoot, "host", "src", "index.ts"));
  const hostCwd = useBundledHost ? root : path.join(passbookRoot, "host");
  const hostCommand = env.PASSBOOK_HOST_COMMAND ?? "node";
  const hostArgs = useBundledHost
    ? [hostEntry]
    : ["--import", "tsx", hostEntry];
  const appVersion = env.APP_VERSION ?? "0.1.0";

  return {
    root,
    dataDir,
    backupDir,
    host,
    port,
    hostUrl,
    clientDevUrl,
    clientDist,
    hostEntry,
    hostCwd,
    hostCommand,
    hostArgs,
    appVersion,
  };
}
