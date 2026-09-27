import { mkdir, rm } from "node:fs/promises";

await rm(".data/e2e", { force: true, recursive: true });
await mkdir(".data/e2e", { recursive: true });
