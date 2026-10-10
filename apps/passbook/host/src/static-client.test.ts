import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";

import { serveClientAsset } from "./static-client";

let directory: string | undefined;

afterEach(async () => {
  vi.unstubAllEnvs();
  if (directory) await rm(directory, { recursive: true, force: true });
});

it("serves the bundled PDF module worker with a JavaScript MIME type", async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "passbook-client-"));
  vi.stubEnv("PASSBOOK_CLIENT_DIST", directory);
  const worker = "export const WorkerMessageHandler = {};";
  await writeFile(path.join(directory, "pdf.worker.min-test.mjs"), worker);

  const url = "http://127.0.0.1:3847/pdf.worker.min-test.mjs";
  const response = await serveClientAsset(new Request(url));
  expect(response?.status).toBe(200);
  expect(response?.headers.get("content-type")).toBe(
    "text/javascript; charset=utf-8",
  );
  expect(await response?.text()).toBe(worker);

  const head = await serveClientAsset(new Request(url, { method: "HEAD" }));
  expect(head?.headers.get("content-type")).toBe(
    "text/javascript; charset=utf-8",
  );
  expect(await head?.text()).toBe("");
});
