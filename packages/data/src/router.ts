import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

import type { DataPlatform } from "./platform";
import { BackupVerificationError } from "./backup/backups";
import { DataPlatformBusyError } from "./platform";

const t = initTRPC.create();

const backupInput = z.object({ id: z.string() });
const fileNamesInput = z.object({
  names: z.array(z.string().regex(/^[^./\\][^/\\]*$/)).max(1000),
});

async function conflictWhenBusy<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof DataPlatformBusyError)) throw error;
    throw new TRPCError({
      code: "CONFLICT",
      message: error.message,
      cause: error,
    });
  }
}

export function createDataRouter(platform: DataPlatform) {
  async function findBackup(id: string) {
    const backup = await platform.backups.find(id);
    if (!backup) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Backup ${id} not found`,
      });
    }
    return backup;
  }

  return t.router({
    backups: t.router({
      list: t.procedure.query(async () => ({
        app: platform.app,
        backups: await platform.backups.list(),
      })),
      status: t.procedure.query(() => platform.backups.status()),
      create: t.procedure.mutation(() => platform.backups.create()),
      verify: t.procedure
        .input(backupInput)
        .mutation(async ({ input }) =>
          platform.backups.verify((await findBackup(input.id)).path),
        ),
      restore: t.procedure.input(backupInput).mutation(async ({ input }) => {
        const backup = await findBackup(input.id);
        try {
          return await conflictWhenBusy(() =>
            platform.backups.restore(backup.path),
          );
        } catch (error) {
          if (!(error instanceof BackupVerificationError)) throw error;
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
            cause: error,
          });
        }
      }),
    }),
    usage: t.router({
      get: t.procedure.query(() => conflictWhenBusy(() => platform.usage())),
    }),
    schedule: t.router({
      get: t.procedure.query(() => platform.schedule()),
    }),
    integrity: t.router({
      last: t.procedure.query(() => platform.integrity.lastReport()),
      scan: t.procedure.mutation(() =>
        conflictWhenBusy(() => platform.integrity.scan()),
      ),
      quarantine: t.procedure
        .input(fileNamesInput)
        .mutation(({ input }) =>
          conflictWhenBusy(() => platform.integrity.quarantine(input.names)),
        ),
      purge: t.procedure
        .input(fileNamesInput)
        .mutation(({ input }) =>
          conflictWhenBusy(() => platform.integrity.purge(input.names)),
        ),
    }),
  });
}

export type DataRouter = ReturnType<typeof createDataRouter>;
