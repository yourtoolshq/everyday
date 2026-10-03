import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

export interface HostProcessOptions {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

export class HostProcess {
  private child: ChildProcess | null = null;
  private stderr = "";

  constructor(private readonly options: HostProcessOptions) {}

  start() {
    if (this.child) return;
    this.child = spawn(this.options.command, this.options.args, {
      cwd: this.options.cwd,
      env: { ...process.env, ...this.options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.child.stderr?.on("data", (chunk) => {
      this.stderr += String(chunk);
      if (this.stderr.length > 8_000) {
        this.stderr = this.stderr.slice(-8_000);
      }
    });
  }

  async waitForHealth(baseUrl: string, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.child && this.child.exitCode !== null) {
        throw new Error(
          `Passbook host exited during startup (${this.child.exitCode}).\n${this.stderr}`,
        );
      }
      try {
        const response = await fetch(`${baseUrl}/api/health`);
        const body = (await response.json()) as { status?: string };
        if (
          response.ok &&
          (body.status === "ok" || body.status === "maintenance")
        ) {
          return;
        }
      } catch {
        // Host is still booting.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(
      `Passbook host did not become ready at ${baseUrl}.\n${this.stderr}`,
    );
  }

  async stop(timeoutMs = 10_000) {
    if (!this.child || this.child.killed) return;
    const child = this.child;
    this.child = null;
    child.kill("SIGTERM");
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, timeoutMs);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      child.once("error", reject);
    });
  }

  isRunning() {
    return this.child !== null && this.child.exitCode === null;
  }

  getRecentStderr() {
    return this.stderr;
  }
}
