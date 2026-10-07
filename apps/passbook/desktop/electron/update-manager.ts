import { app, dialog } from "electron";
import { autoUpdater } from "electron-updater";

import { isHostHealthy } from "./host-connectivity.js";
import { UpdateOrchestrator } from "./update-orchestrator.js";

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

export interface UpdateManagerOptions {
  dataDir: string;
  hostUrl: string;
  previousVersion: string;
}

async function createPreUpdateBackup(hostUrl: string) {
  const response = await fetch(`${hostUrl}/api/data/trpc/backups.create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: null }),
  });
  const body = (await response.json()) as {
    result?: {
      data?: { json?: { id?: string; verification?: { ok?: boolean } } };
    };
    error?: unknown;
  };

  if (!response.ok || !body.result?.data?.json?.id) {
    throw new Error(
      "Passbook could not create a verified backup before updating.",
    );
  }
  if (body.result.data.json.verification?.ok !== true) {
    throw new Error("Passbook created a backup, but verification failed.");
  }
  return body.result.data.json.id;
}

async function resumePendingUpdate(
  orchestrator: UpdateOrchestrator,
  hostUrl: string,
) {
  const intent = await orchestrator.readIntent();
  if (!intent || intent.stage === "failed") return;

  if (intent.stage === "trial") {
    if (!(await isHostHealthy(hostUrl))) {
      await orchestrator.markFailed("Updated host did not become ready.");
      dialog.showErrorBox(
        "Passbook update incomplete",
        "The updated app could not start cleanly. Restore from the backup recorded in Settings → Data & backups.",
      );
      return;
    }
    await orchestrator.markTrialReady();
    await orchestrator.commit();
    return;
  }

  if (intent.stage === "backup" || intent.stage === "commit") {
    dialog.showErrorBox(
      "Passbook update incomplete",
      "A previous update did not finish. Restore from the backup recorded in Settings → Data & backups before continuing.",
    );
  }
}

export async function setupAutoUpdater(options: UpdateManagerOptions) {
  if (!app.isPackaged) return;

  const orchestrator = new UpdateOrchestrator({ dataDir: options.dataDir });
  await resumePendingUpdate(orchestrator, options.hostUrl);

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("error", (error) => {
    console.error("Passbook update check failed:", error);
  });

  autoUpdater.on("update-available", (info) => {
    void dialog
      .showMessageBox({
        type: "info",
        buttons: ["Download", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "Passbook update available",
        message: `Version ${info.version} is available.`,
        detail:
          "Passbook will create a verified backup before installing the update.",
      })
      .then(({ response }) => {
        if (response === 0) {
          void autoUpdater.downloadUpdate();
        }
      });
  });

  autoUpdater.on("update-not-available", () => {
    // No-op; silent background checks are expected.
  });

  autoUpdater.on("update-downloaded", (info) => {
    void dialog
      .showMessageBox({
        type: "question",
        buttons: ["Install and restart", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "Passbook update ready",
        message: `Version ${info.version} has been downloaded.`,
        detail:
          "Passbook will back up your data, restart, and apply the update.",
      })
      .then(async ({ response }) => {
        if (response !== 0) return;

        try {
          await orchestrator.beginUpdate(info.version, options.previousVersion);
          const backupId = await createPreUpdateBackup(options.hostUrl);
          await orchestrator.markBackupComplete(backupId);
          await orchestrator.markTrialReady();
          autoUpdater.quitAndInstall();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown update failure.";
          await orchestrator.markFailed(message);
          dialog.showErrorBox("Passbook update failed", message);
        }
      });
  });

  const checkForUpdates = () => {
    void autoUpdater.checkForUpdates().catch((error) => {
      console.error("Passbook update check failed:", error);
    });
  };

  setTimeout(checkForUpdates, 15_000);
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
}
