import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { UpdateOrchestrator } from "../electron/update-orchestrator";

describe("UpdateOrchestrator", () => {
  let dataDir: string;
  let orchestrator: UpdateOrchestrator;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "passbook-update-"));
    orchestrator = new UpdateOrchestrator({ dataDir });
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it("records durable update intent through commit", async () => {
    const started = await orchestrator.beginUpdate("0.2.0", "0.1.0");
    expect(started.stage).toBe("backup");

    const trial = await orchestrator.markBackupComplete("backup-1");
    expect(trial.stage).toBe("trial");
    expect(trial.backupId).toBe("backup-1");

    const commit = await orchestrator.markTrialReady();
    expect(commit.stage).toBe("commit");

    await orchestrator.commit();
    expect(await orchestrator.readIntent()).toBeNull();
  });

  it("marks failed updates without clearing the intent", async () => {
    await orchestrator.beginUpdate("0.2.0", "0.1.0");
    const failed = await orchestrator.markFailed("backup verification failed");
    expect(failed.stage).toBe("failed");
    expect(failed.failureReason).toContain("verification");
  });
});
