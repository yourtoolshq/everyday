import { contextBridge, ipcRenderer } from "electron";

import type {
  DesktopUpdateActionResult,
  DesktopUpdateState,
} from "./update-types.js";

function readHostUrl() {
  const arg = process.argv.find((entry) =>
    entry.startsWith("--passbook-host-url="),
  );
  if (arg) {
    return arg.slice("--passbook-host-url=".length);
  }
  return process.env.PASSBOOK_HOST_URL ?? "http://127.0.0.1:3847";
}

contextBridge.exposeInMainWorld("passbookDesktop", {
  hostUrl: readHostUrl(),
  updates: {
    getState: (): Promise<DesktopUpdateState> =>
      ipcRenderer.invoke("passbook:update:get-state"),
    subscribe: (listener: (state: DesktopUpdateState) => void) => {
      const handler = (_event: unknown, state: DesktopUpdateState) => {
        listener(state);
      };
      ipcRenderer.on("passbook:update:state", handler);
      return () => {
        ipcRenderer.removeListener("passbook:update:state", handler);
      };
    },
    checkForUpdates: (): Promise<DesktopUpdateActionResult> =>
      ipcRenderer.invoke("passbook:update:check"),
    downloadUpdate: (): Promise<DesktopUpdateActionResult> =>
      ipcRenderer.invoke("passbook:update:download"),
    installUpdate: (): Promise<DesktopUpdateActionResult> =>
      ipcRenderer.invoke("passbook:update:install"),
    dismissUpdate: (): Promise<DesktopUpdateState> =>
      ipcRenderer.invoke("passbook:update:dismiss"),
    commitTrial: (): Promise<DesktopUpdateActionResult> =>
      ipcRenderer.invoke("passbook:update:commit-trial"),
    markTrialFailed: (reason: string): Promise<DesktopUpdateActionResult> =>
      ipcRenderer.invoke("passbook:update:mark-trial-failed", reason),
    dismissTrialFailure: (): Promise<DesktopUpdateActionResult> =>
      ipcRenderer.invoke("passbook:update:dismiss-trial-failure"),
  },
});
