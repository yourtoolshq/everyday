import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { Readable } from "node:stream";
import type { ResultSet } from "@libsql/client";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import type { StoredFile } from "../schema";
import type { DetectedFileType } from "./detect";
import { filesTable } from "../schema";
import { createFileTokenValue, parseFileToken } from "./router";

export type Database = BaseSQLiteDatabase<
  "async",
  ResultSet,
  Record<string, unknown>
>;

type TransactionOf<TDb extends Database> = Parameters<
  Parameters<TDb["transaction"]>[0]
>[0];

export interface StagedUpload {
  token: string;
  name: string;
  size: number;
  mimeType: string;
}

interface StagedMetadata {
  endpoint: string;
  originalFilename: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  sha256: string;
}

export interface FileTransaction {
  claim: (token: string) => Promise<StoredFile>;
  remove: (fileId: string) => Promise<void>;
}

interface PendingFileChange {
  path: string;
  rollback: () => Promise<void>;
  commit: () => Promise<void>;
}

export type FileCoordinator = ReturnType<typeof createFileCoordinator>;

// Shared by every store over the same documents directory. `guard` keeps a file
// transaction and its post-commit file changes inside one unit of database work, and a
// backup holds deletes so the files referenced by its snapshot stay on disk until archived.
export function createFileCoordinator(
  guard: <T>(work: () => Promise<T>) => Promise<T>,
) {
  let holds = 0;
  let deferred: (() => Promise<void>)[] = [];

  async function discard(
    path: string,
    file: Pick<StoredFile, "id" | "storageKey">,
  ) {
    try {
      await unlink(path);
    } catch (error) {
      if (!isMissing(error)) throw error;
      console.warn("removed file was already missing on disk", {
        fileId: file.id,
        storageKey: file.storageKey,
      });
    }
  }

  return {
    discard(path: string, file: Pick<StoredFile, "id" | "storageKey">) {
      if (holds === 0) return discard(path, file);
      deferred.push(() => discard(path, file));
      return Promise.resolve();
    },
    holdDeletes() {
      holds += 1;
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        holds -= 1;
        if (holds > 0) return;
        const pending = deferred;
        deferred = [];
        const outcomes = await Promise.allSettled(pending.map((run) => run()));
        for (const outcome of outcomes) {
          if (outcome.status === "rejected") {
            console.warn("failed to discard removed file", {
              error: outcome.reason as unknown,
            });
          }
        }
      };
    },
    guard,
  };
}

export const storageKeyPattern = /^[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;

const stagedUploadLifetimeMs = 24 * 60 * 60 * 1000;

// Deletes staged files older than the upload lifetime; `claim` refuses those uploads from
// the same moment. Failures are logged, not thrown, so they never block an upload or boot.
export async function removeExpiredUploads(documentsDir: string) {
  const stagingDir = join(resolve(documentsDir), ".staging");
  try {
    let names: string[];
    try {
      names = await readdir(stagingDir);
    } catch (error) {
      if (isMissing(error)) return;
      throw error;
    }
    let removed = 0;
    for (const name of names) {
      const path = join(stagingDir, name);
      let modifiedAt: number;
      try {
        modifiedAt = (await stat(path)).mtimeMs;
      } catch (error) {
        if (isMissing(error)) continue;
        throw error;
      }
      if (Date.now() - modifiedAt < stagedUploadLifetimeMs) continue;
      await rm(path, { force: true });
      removed += 1;
    }
    if (removed > 0) {
      console.info("expired uploads removed", { stagingDir, removed });
    }
  } catch (error) {
    console.warn("failed to remove expired uploads", { stagingDir, error });
  }
}

export type FileStore = ReturnType<typeof createFileStore>;

export function createFileStore(options: {
  db: Database;
  documentsDir: string;
  coordinator: FileCoordinator;
}) {
  const root = resolve(options.documentsDir);
  const stagingDir = join(root, ".staging");
  const { coordinator } = options;

  function storedPath(storageKey: string) {
    if (
      !storageKeyPattern.test(storageKey) ||
      basename(storageKey) !== storageKey
    ) {
      throw new Error(`Invalid storage key: ${storageKey}`);
    }
    return join(root, storageKey);
  }

  function stagedPaths(id: string) {
    return {
      data: join(stagingDir, id),
      metadata: join(stagingDir, `${id}.json`),
    };
  }

  async function stage(input: {
    endpoint: string;
    originalFilename: string;
    bytes: Uint8Array;
    type: DetectedFileType;
  }): Promise<StagedUpload> {
    await removeExpiredUploads(root);
    await mkdir(stagingDir, { recursive: true });
    const id = randomUUID();
    const paths = stagedPaths(id);
    const metadata: StagedMetadata = {
      endpoint: input.endpoint,
      originalFilename: input.originalFilename,
      mimeType: input.type.mimeType,
      extension: input.type.extension,
      sizeBytes: input.bytes.byteLength,
      sha256: createHash("sha256").update(input.bytes).digest("hex"),
    };
    await writeFile(paths.data, input.bytes, { flag: "wx" });
    // Metadata is written last so its presence means the staged bytes are complete.
    await writeFile(paths.metadata, JSON.stringify(metadata), { flag: "wx" });
    return {
      token: createFileTokenValue(input.endpoint, id),
      name: metadata.originalFilename,
      size: metadata.sizeBytes,
      mimeType: metadata.mimeType,
    };
  }

  async function get(fileId: string) {
    const [file] = await options.db
      .select()
      .from(filesTable)
      .where(eq(filesTable.id, fileId));
    return file ?? null;
  }

  async function locate(fileId: string) {
    const file = await get(fileId);
    if (!file) return null;
    const path = storedPath(file.storageKey);
    try {
      const { size } = await stat(path);
      return { file, path, size };
    } catch (error) {
      if (!isMissing(error)) throw error;
      console.warn("stored file missing on disk", {
        fileId,
        storageKey: file.storageKey,
      });
      return null;
    }
  }

  async function read(fileId: string) {
    const located = await locate(fileId);
    if (!located) return null;
    return { file: located.file, bytes: await readFile(located.path) };
  }

  async function stream(fileId: string) {
    const located = await locate(fileId);
    if (!located) return null;
    return {
      file: located.file,
      size: located.size,
      body: Readable.toWeb(createReadStream(located.path)) as ReadableStream,
    };
  }

  function fileTransaction(
    tx: Database,
    pending: PendingFileChange[],
  ): FileTransaction {
    return {
      async claim(token) {
        const parsed = parseFileToken(token);
        if (!parsed) throw expiredUpload();
        const paths = stagedPaths(parsed.id);
        const metadata = await readStagedMetadata(paths.metadata);
        if (metadata?.endpoint !== parsed.endpoint) throw expiredUpload();

        const id = randomUUID();
        const [file] = await tx
          .insert(filesTable)
          .values({
            id,
            storageKey: `${id}.${metadata.extension}`,
            originalFilename: metadata.originalFilename,
            mimeType: metadata.mimeType,
            sizeBytes: metadata.sizeBytes,
            sha256: metadata.sha256,
            endpoint: metadata.endpoint,
          })
          .returning();
        if (!file) throw new Error(`Failed to record claimed file ${id}`);

        const path = storedPath(file.storageKey);
        try {
          await rename(paths.data, path);
        } catch (error) {
          if (isMissing(error)) throw expiredUpload();
          throw error;
        }
        pending.push({
          path,
          rollback: () => rename(path, paths.data),
          commit: () => rm(paths.metadata, { force: true }),
        });
        return file;
      },

      async remove(fileId) {
        const [file] = await tx
          .delete(filesTable)
          .where(eq(filesTable.id, fileId))
          .returning();
        if (!file) return;

        const path = storedPath(file.storageKey);
        pending.push({
          path,
          rollback: () => Promise.resolve(),
          commit: () => coordinator.discard(path, file),
        });
      },
    };
  }

  function withFiles<TDb extends Database, TResult>(
    db: TDb,
    fn: (tx: TransactionOf<TDb>, files: FileTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    return coordinator.guard(() => runWithFiles(db, fn));
  }

  async function runWithFiles<TDb extends Database, TResult>(
    db: TDb,
    fn: (tx: TransactionOf<TDb>, files: FileTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    const pending: PendingFileChange[] = [];
    let result: TResult;
    try {
      result = await db.transaction((tx) =>
        fn(tx as TransactionOf<TDb>, fileTransaction(tx, pending)),
      );
    } catch (error) {
      for (const change of pending.reverse()) {
        try {
          await change.rollback();
        } catch (rollbackError) {
          console.error("failed to roll back file change", {
            path: change.path,
            error: rollbackError,
          });
        }
      }
      throw error;
    }
    const committed = await Promise.allSettled(
      pending.map((change) => change.commit()),
    );
    committed.forEach((outcome, index) => {
      if (outcome.status === "rejected") {
        console.warn("failed to clean up after file change", {
          path: pending[index]?.path,
          error: outcome.reason as unknown,
        });
      }
    });
    return result;
  }

  return { stage, get, read, stream, withFiles };
}

// Null when the upload was never completed, was already claimed, or has expired.
async function readStagedMetadata(path: string) {
  try {
    const { mtimeMs } = await stat(path);
    if (Date.now() - mtimeMs >= stagedUploadLifetimeMs) return null;
    return JSON.parse(await readFile(path, "utf8")) as StagedMetadata;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

function expiredUpload() {
  return new TRPCError({
    code: "BAD_REQUEST",
    message: "The uploaded file is no longer available. Upload it again.",
  });
}

function isMissing(error: unknown) {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}
