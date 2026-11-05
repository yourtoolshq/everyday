import { appendFile, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const HISTORY_FILE_NAME = ".update-history.log";
const MAX_HISTORY_BYTES = 32_768;

export interface UpdateHistoryEntry {
  event: string;
  currentVersion?: string;
  targetVersion?: string;
  stage?: string;
  result?: "ok" | "failed" | "timeout";
  error?: string;
}

export function getUpdateHistoryPath(dataDir: string) {
  return join(dataDir, HISTORY_FILE_NAME);
}

export async function appendUpdateHistory(
  dataDir: string,
  entry: UpdateHistoryEntry,
): Promise<void> {
  try {
    const path = getUpdateHistoryPath(dataDir);
    const line = `${JSON.stringify({
      at: new Date().toISOString(),
      ...entry,
    })}\n`;
    await appendFile(path, line, "utf8");
    await trimUpdateHistory(path);
  } catch {
    // Best-effort diagnostics only.
  }
}

async function trimUpdateHistory(path: string) {
  let size = 0;
  try {
    size = (await stat(path)).size;
  } catch {
    return;
  }
  if (size <= MAX_HISTORY_BYTES) return;

  const raw = await readFile(path, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  const kept: string[] = [];
  let bytes = 0;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const entry = lines[index];
    if (!entry) continue;
    const line = `${entry}\n`;
    if (bytes + line.length > MAX_HISTORY_BYTES) break;
    kept.unshift(entry);
    bytes += line.length;
  }
  await writeFile(path, kept.length > 0 ? `${kept.join("\n")}\n` : "", "utf8");
}
