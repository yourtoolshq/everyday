import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HostProcess } from "../electron/host-process.js";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("HostProcess.stop", () => {
  it("waits for the process to exit after SIGKILL", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "passbook-host-stop-"));
    tempDirs.push(cwd);

    const host = new HostProcess({
      command: process.execPath,
      args: [
        "-e",
        `process.on("SIGTERM", () => {});
         process.stderr.write("READY:" + process.pid);
         setInterval(() => {}, 60_000);`,
      ],
      cwd,
      env: {},
    });

    host.start();
    try {
      await vi.waitFor(() =>
        expect(host.getRecentStderr()).toContain("READY:"),
      );
      const pid = Number(host.getRecentStderr().split("READY:")[1]);
      const started = Date.now();
      const stopping = host.stop(100);
      host.start(); // A sent signal does not mean the old writer has exited.
      await Promise.all([stopping, host.stop(100)]);
      expect(Date.now() - started).toBeGreaterThanOrEqual(90);
      expect(host.isRunning()).toBe(false);
      expect(() => process.kill(pid, 0)).toThrow();
    } finally {
      await host.stop(100);
    }
  });

  it("allows starting a fresh host after stop", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "passbook-host-restart-"));
    tempDirs.push(cwd);

    const host = new HostProcess({
      command: process.execPath,
      args: ["-e", "setTimeout(() => {}, 30_000)"],
      cwd,
      env: {},
    });

    host.start();
    await host.stop(100);
    host.start();
    expect(host.isRunning()).toBe(true);
    await host.stop(100);
    expect(host.isRunning()).toBe(false);
  });
});
