import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const passbookRoot = path.resolve(desktopRoot, "..");

export function resolveDesktopPaths(env: NodeJS.ProcessEnv = process.env) {
  const dataDir =
    env.DATA_DIR ?? path.join(passbookRoot, ".data", "desktop-test");
  const backupDir = env.BACKUP_DIR ?? path.join(dataDir, "backups");
  const host = env.HOST ?? "127.0.0.1";
  const port = env.PORT ?? "3847";
  const hostUrl = `http://${host}:${port}`;
  const clientDevUrl = env.PASSBOOK_CLIENT_DEV_URL ?? "http://127.0.0.1:5173";
  const clientDist = path.join(passbookRoot, "client", "dist", "index.html");

  return {
    dataDir,
    backupDir,
    host,
    port,
    hostUrl,
    clientDevUrl,
    clientDist,
    hostEntry: path.join(passbookRoot, "host", "src", "index.ts"),
    hostCwd: path.join(passbookRoot, "host"),
  };
}
