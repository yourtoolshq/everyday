import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type UpdateStage = "idle" | "backup" | "trial" | "commit" | "failed";

export interface UpdateIntent {
  targetVersion: string;
  previousVersion: string;
  stage: UpdateStage;
  backupId?: string;
  failureReason?: string;
  startedAt: string;
  updatedAt: string;
}

export interface UpdateOrchestratorOptions {
  dataDir: string;
}

export class UpdateOrchestrator {
  private readonly intentPath: string;

  constructor(private readonly options: UpdateOrchestratorOptions) {
    this.intentPath = join(options.dataDir, ".update", "intent.json");
  }

  async readIntent(): Promise<UpdateIntent | null> {
    try {
      const raw = await readFile(this.intentPath, "utf8");
      return JSON.parse(raw) as UpdateIntent;
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async beginUpdate(
    targetVersion: string,
    previousVersion: string,
  ): Promise<UpdateIntent> {
    const existing = await this.readIntent();
    if (existing && existing.stage !== "failed") {
      throw new Error(`An update is already in progress (${existing.stage}).`);
    }
    const now = new Date().toISOString();
    const intent: UpdateIntent = {
      targetVersion,
      previousVersion,
      stage: "backup",
      startedAt: now,
      updatedAt: now,
    };
    await this.writeIntent(intent);
    return intent;
  }

  async markBackupComplete(backupId: string): Promise<UpdateIntent> {
    const intent = await this.requireIntent("backup");
    const next: UpdateIntent = {
      ...intent,
      stage: "trial",
      backupId,
      updatedAt: new Date().toISOString(),
    };
    await this.writeIntent(next);
    return next;
  }

  async markTrialReady(): Promise<UpdateIntent> {
    const intent = await this.requireIntent("trial");
    const next: UpdateIntent = {
      ...intent,
      stage: "commit",
      updatedAt: new Date().toISOString(),
    };
    await this.writeIntent(next);
    return next;
  }

  async commit(): Promise<void> {
    const intent = await this.requireIntent("commit");
    if (!intent.backupId) {
      throw new Error("Update commit requires a verified backup checkpoint.");
    }
    await rm(join(this.options.dataDir, ".update"), {
      recursive: true,
      force: true,
    });
  }

  async markFailed(reason: string): Promise<UpdateIntent> {
    const intent = await this.readIntent();
    if (!intent) {
      throw new Error("No update intent to mark failed.");
    }
    const next: UpdateIntent = {
      ...intent,
      stage: "failed",
      failureReason: reason,
      updatedAt: new Date().toISOString(),
    };
    await this.writeIntent(next);
    return next;
  }

  private async requireIntent(stage: UpdateStage) {
    const intent = await this.readIntent();
    if (intent?.stage !== stage) {
      throw new Error(
        `Expected update stage ${stage}, got ${intent?.stage ?? "none"}.`,
      );
    }
    return intent;
  }

  private async writeIntent(intent: UpdateIntent) {
    const dir = join(this.options.dataDir, ".update");
    await mkdir(dir, { recursive: true });
    const tmp = join(dir, "intent.json.tmp");
    await writeFile(tmp, JSON.stringify(intent, null, 2));
    await rename(tmp, this.intentPath);
  }
}

function isMissing(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
