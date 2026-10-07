import { ipcMain } from "electron";

import type { UpdateController } from "./update-controller.js";

export function registerUpdateIpc(controller: UpdateController) {
  ipcMain.handle("passbook:update:get-state", () => controller.getState());

  ipcMain.handle("passbook:update:check", () => controller.checkForUpdates());

  ipcMain.handle("passbook:update:download", () => controller.downloadUpdate());

  ipcMain.handle("passbook:update:install", () => controller.installUpdate());

  ipcMain.handle("passbook:update:dismiss", () => {
    controller.dismiss();
    return controller.getState();
  });

  ipcMain.handle("passbook:update:commit-trial", () =>
    controller.commitTrial(),
  );

  ipcMain.handle("passbook:update:mark-trial-failed", (_event, reason) => {
    const message =
      typeof reason === "string" && reason.trim().length > 0
        ? reason
        : "The updated app could not start cleanly.";
    return controller.markTrialFailed(message);
  });
}
