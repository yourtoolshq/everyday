import { app } from "electron";

import type { UpdateController } from "./update-controller.js";
import { UpdateController as Controller } from "./update-controller.js";
import { registerUpdateIpc } from "./update-ipc.js";

let controller: UpdateController | null = null;

export function getUpdateController() {
  return controller;
}

export async function setupAutoUpdater(options: {
  dataDir: string;
  hostUrl: string;
  previousVersion: string;
}) {
  if (!app.isPackaged) return null;

  controller = new Controller({
    dataDir: options.dataDir,
    hostUrl: options.hostUrl,
    currentVersion: options.previousVersion,
  });
  registerUpdateIpc(controller);
  await controller.start();
  return controller;
}
