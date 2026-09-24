import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, join } from "node:path";
import { z } from "zod";

export interface DataLayout {
  dataDir: string;
  databasePath: string;
  documentsDir: string;
}

const markerSchema = z.object({
  stage: z.enum(["swapping", "swapped"]),
  archive: z.string(),
  preRestoreBackup: z.string(),
});
export type RestoreMarker = z.infer<typeof markerSchema>;

// A restore moves the live data aside, moves the extracted archive into place, and only
// then discards the aside copy. The marker records how far it got so boot can finish or
// roll back a restore the process did not survive.
export function restorePaths(layout: DataLayout) {
  const restoreDir = join(layout.dataDir, ".restore");
  return {
    restoreDir,
    incomingDir: join(restoreDir, "incoming"),
    previousDir: join(restoreDir, "previous"),
    marker: join(layout.dataDir, "restore.inprogress"),
  };
}

// Moved in this order, so the database is always the first thing set aside.
function swappedItems(layout: DataLayout) {
  const database = basename(layout.databasePath);
  return [
    { name: database, current: layout.databasePath },
    ...["-journal", "-wal", "-shm"].map((suffix) => ({
      name: `${database}${suffix}`,
      current: `${layout.databasePath}${suffix}`,
    })),
    { name: "documents", current: layout.documentsDir },
  ];
}

export async function writeMarker(layout: DataLayout, marker: RestoreMarker) {
  const { marker: path } = restorePaths(layout);
  await writeFile(`${path}.tmp`, JSON.stringify(marker));
  await rename(`${path}.tmp`, path);
}

export async function readMarker(layout: DataLayout) {
  try {
    const raw = await readFile(restorePaths(layout).marker, "utf8");
    return markerSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

export async function swapIn(layout: DataLayout) {
  const { incomingDir, previousDir } = restorePaths(layout);
  await mkdir(previousDir, { recursive: true });
  for (const item of swappedItems(layout)) {
    await moveIfPresent(item.current, join(previousDir, item.name));
  }
  await rename(join(incomingDir, "db.sqlite"), layout.databasePath);
  await mkdir(join(incomingDir, "documents"), { recursive: true });
  await rename(join(incomingDir, "documents"), layout.documentsDir);
}

export async function rollbackSwap(layout: DataLayout) {
  const { previousDir } = restorePaths(layout);
  const moved = new Set(await readdirIfPresent(previousDir));
  if (moved.size === 0) return;
  for (const item of swappedItems(layout)) {
    if (item.name === "documents" && !moved.has(item.name)) continue;
    await rm(item.current, { recursive: true, force: true });
    if (moved.has(item.name)) {
      await rename(join(previousDir, item.name), item.current);
    }
  }
}

export async function clearRestore(layout: DataLayout) {
  const { restoreDir, marker } = restorePaths(layout);
  await rm(restoreDir, { recursive: true, force: true });
  await rm(marker, { force: true });
}

async function moveIfPresent(from: string, to: string) {
  try {
    await rename(from, to);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

async function readdirIfPresent(path: string) {
  try {
    return await readdir(path);
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
}

export function isMissing(error: unknown) {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}
