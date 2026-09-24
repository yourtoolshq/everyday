import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

import type { DataPlatform } from "./platform";
import { BackupVerificationError } from "./backup/backups";
import { DataPlatformBusyError } from "./platform";

const t = initTRPC.create();

const backupInput = z.object({ id: z.string() });

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
      create: t.procedure.mutation(() => platform.backups.create()),
      verify: t.procedure
        .input(backupInput)
        .mutation(async ({ input }) =>
          platform.backups.verify((await findBackup(input.id)).path),
        ),
      restore: t.procedure.input(backupInput).mutation(async ({ input }) => {
        const backup = await findBackup(input.id);
        try {
          return await platform.backups.restore(backup.path);
        } catch (error) {
          if (error instanceof DataPlatformBusyError) {
            throw new TRPCError({
              code: "CONFLICT",
              message: error.message,
              cause: error,
            });
          }
          if (!(error instanceof BackupVerificationError)) throw error;
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
            cause: error,
          });
        }
      }),
    }),
  });
}

export type DataRouter = ReturnType<typeof createDataRouter>;
