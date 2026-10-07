import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog } from "electron";

import type { DesktopPaths } from "./config.js";
import { moveLegacyDesktopBackups } from "./backup-location.js";
import { resolveDesktopPaths } from "./config.js";
import { isHostHealthy } from "./host-connectivity.js";
import { HostProcess } from "./host-process.js";
import { attachNavigationGuard } from "./navigation.js";
import { getUpdateController, setupAutoUpdater } from "./update-manager.js";

let paths: DesktopPaths | null = null;
let host: HostProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let errorWindow: BrowserWindow | null = null;
let quitting = false;
let hostOwnedByDesktop = false;

function configurePackagedEnv() {
  if (!app.isPackaged) return;
  process.env.APP_VERSION = app.getVersion();
  process.env.PASSBOOK_PACKAGED = "1";
  process.env.PASSBOOK_USER_DATA_DIR = app.getPath("userData");
  process.env.PASSBOOK_ROOT = path.join(process.resourcesPath, "passbook");
  process.env.PASSBOOK_HOST_ENTRY = path.join(
    process.resourcesPath,
    "host",
    "passbook-host.cjs",
  );
  process.env.PASSBOOK_CLIENT_DIST = path.join(process.resourcesPath, "client");
  process.env.PASSBOOK_HOST_COMMAND = process.execPath;
  process.env.PASSBOOK_USE_BUNDLED_HOST = "1";
}

function getPaths() {
  if (!paths) {
    configurePackagedEnv();
    paths = resolveDesktopPaths();
    if (app.isPackaged && !process.env.BACKUP_DIR) {
      try {
        moveLegacyDesktopBackups(paths.dataDir, paths.backupDir);
      } catch (error) {
        console.warn("Passbook could not move legacy desktop backups:", error);
      }
    }
    host = new HostProcess({
      command: paths.hostCommand,
      args: paths.hostArgs,
      cwd: paths.hostCwd,
      env: {
        APP_VERSION: paths.appVersion,
        DATA_DIR: paths.dataDir,
        BACKUP_DIR: paths.backupDir,
        HOST: paths.host,
        PORT: paths.port,
        NODE_ENV: process.env.NODE_ENV ?? "development",
        PASSBOOK_CLIENT_DIST: paths.clientDist,
        PASSBOOK_ROOT: paths.root,
        ...(app.isPackaged ? { ELECTRON_RUN_AS_NODE: "1" } : {}),
      },
    });
  }
  return paths;
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function openPreviewWindow(
  url: string,
  parent: BrowserWindow,
  allowedOrigins: string[],
) {
  const previewWindow = new BrowserWindow({
    width: 960,
    height: 720,
    parent,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  attachNavigationGuard(
    previewWindow.webContents,
    allowedOrigins,
    (nestedUrl) => {
      openPreviewWindow(nestedUrl, previewWindow, allowedOrigins);
    },
  );

  void previewWindow.loadURL(url);
}

async function createMainWindow() {
  const resolved = getPaths();
  const useDevClient =
    !app.isPackaged && process.env.PASSBOOK_DESKTOP_USE_DIST !== "1";
  const loadUrl = useDevClient ? resolved.clientDevUrl : resolved.hostUrl;

  const allowedOrigins = [
    new URL(resolved.clientDevUrl).origin,
    new URL(resolved.hostUrl).origin,
  ];

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    show: false,
    webPreferences: {
      preload: path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "preload.cjs",
      ),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [`--passbook-host-url=${resolved.hostUrl}`],
    },
  });

  attachNavigationGuard(mainWindow.webContents, allowedOrigins, (url) => {
    if (!mainWindow) return;
    openPreviewWindow(url, mainWindow, allowedOrigins);
  });

  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  getUpdateController()?.registerWindow(mainWindow);

  await mainWindow.loadURL(loadUrl);
  mainWindow.show();
}

function showStartupError(message: string) {
  errorWindow = new BrowserWindow({
    width: 640,
    height: 420,
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const html = `<!doctype html><html><body style="font-family: system-ui; padding: 24px;"><h1>Passbook could not start</h1><p>${message.replaceAll(
    "\n",
    "<br/>",
  )}</p></body></html>`;
  void errorWindow.loadURL(`data:text/html,${encodeURIComponent(html)}`);
}

async function ensureHostReady() {
  const resolved = getPaths();
  if (!host) throw new Error("Host process is not configured.");
  if (await isHostHealthy(resolved.hostUrl)) {
    return;
  }

  host.start();
  hostOwnedByDesktop = true;
  await host.waitForHealth(resolved.hostUrl);
}

if (gotSingleInstanceLock) {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  void app.whenReady().then(async () => {
    try {
      await ensureHostReady();
      const resolved = getPaths();
      await setupAutoUpdater({
        dataDir: resolved.dataDir,
        hostUrl: resolved.hostUrl,
        previousVersion: resolved.appVersion,
      });
      await createMainWindow();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown startup failure.";
      showStartupError(message);
      dialog.showErrorBox("Passbook startup failed", message);
    }
  });
}

app.on("before-quit", () => {
  quitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") return;
});

app.on("activate", () => {
  if (mainWindow) mainWindow.show();
});

app.on("before-quit", (event) => {
  if (
    !hostOwnedByDesktop ||
    !host?.isRunning() ||
    process.env.PASSBOOK_LEAVE_HOST_RUNNING === "1"
  ) {
    return;
  }
  event.preventDefault();
  quitting = true;
  void host.stop().finally(() => app.exit(0));
});
