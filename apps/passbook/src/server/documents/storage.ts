import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { env } from "~/env";

const storageKeyPattern =
  /^[0-9a-f-]{36}\.(pdf|jpg|png|webp|heic|eml|mp3|m4a|wav|ogg)$/;

export function documentPath(storageKey: string) {
  if (!storageKeyPattern.test(storageKey) || basename(storageKey) !== storageKey) {
    throw new Error("Invalid document storage key");
  }
  const root = resolve(env.DOCUMENTS_DIR);
  const path = resolve(root, storageKey);
  if (!path.startsWith(`${root}/`)) throw new Error("Invalid document storage path");
  return path;
}

export async function writeDocument(storageKey: string, bytes: Uint8Array) {
  await mkdir(resolve(env.DOCUMENTS_DIR), { recursive: true });
  await writeFile(documentPath(storageKey), bytes, { flag: "wx" });
}

export async function readDocument(storageKey: string) {
  return readFile(documentPath(storageKey));
}

export async function removeDocument(storageKey: string) {
  try {
    await unlink(documentPath(storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export type StagedDocument = { storageKey: string; stagedPath: string | null };

export async function stageDocumentsForDeletion(storageKeys: string[]) {
  const trashDirectory = resolve(env.DOCUMENTS_DIR, ".trash");
  await mkdir(trashDirectory, { recursive: true });
  const staged: StagedDocument[] = [];

  try {
    for (const storageKey of storageKeys) {
      const stagedPath = resolve(trashDirectory, `${crypto.randomUUID()}.deleted`);
      try {
        await rename(documentPath(storageKey), stagedPath);
        staged.push({ storageKey, stagedPath });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          staged.push({ storageKey, stagedPath: null });
        } else {
          throw error;
        }
      }
    }
    return staged;
  } catch (error) {
    await restoreStagedDocuments(staged);
    throw error;
  }
}

export async function restoreStagedDocuments(staged: StagedDocument[]) {
  for (const item of [...staged].reverse()) {
    if (!item.stagedPath) continue;
    await rename(item.stagedPath, documentPath(item.storageKey));
  }
}

export async function discardStagedDocuments(staged: StagedDocument[]) {
  await Promise.allSettled(
    staged.map((item) => (item.stagedPath ? unlink(item.stagedPath) : Promise.resolve())),
  );
}
