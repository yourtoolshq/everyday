import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog } from "electron";

import { resolveDesktopPaths } from "./config.js";
import { isHostHealthy } from "./host-connectivity.js";
import { HostProcess } from "./host-process.js";
import { isAllowedNavigation } from "./navigation.js";

const paths = resolveDesktopPaths();
const host = new HostProcess({
  entry: paths.hostEntry,
  cwd: paths.hostCwd,
  env: {
    DATA_DIR: paths.dataDir,
    BACKUP_DIR: paths.backupDir,
    HOST: paths.host,
    PORT: paths.port,
    NODE_ENV: process.env.NODE_ENV ?? "development",
  },
});

let mainWindow: BrowserWindow | null = null;
let errorWindow: BrowserWindow | null = null;
let quitting = false;
let hostOwnedByDesktop = false;

const allowedOrigins = [
  new URL(paths.clientDevUrl).origin,
  new URL(paths.hostUrl).origin,
];

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

async function createMainWindow() {
  const useDevClient = process.env.PASSBOOK_DESKTOP_USE_DIST !== "1";
  const loadUrl = useDevClient
    ? paths.clientDevUrl
    : `file://${paths.clientDist}`;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    show: false,
    webPreferences: {
      preload: path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "preload.js",
      ),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [`--passbook-host-url=${paths.hostUrl}`],
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url, allowedOrigins)) {
      event.preventDefault();
    }
  });

  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

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
  if (await isHostHealthy(paths.hostUrl)) {
    return;
  }

  host.start();
  hostOwnedByDesktop = true;
  await host.waitForHealth(paths.hostUrl);
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
    !host.isRunning() ||
    process.env.PASSBOOK_LEAVE_HOST_RUNNING === "1"
  ) {
    return;
  }
  event.preventDefault();
  quitting = true;
  void host.stop().finally(() => app.exit(0));
});
