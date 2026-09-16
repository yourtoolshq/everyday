import { mkdir, rm } from "node:fs/promises";

await mkdir(".data", { recursive: true });
await Promise.all([
  rm(".data/e2e.db", { force: true }),
  rm(".data/e2e.db-shm", { force: true }),
  rm(".data/e2e.db-wal", { force: true }),
  rm(".data/e2e-documents", { force: true, recursive: true }),
]);
