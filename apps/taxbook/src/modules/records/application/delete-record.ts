import { taxbookLog } from "~/core/infrastructure/logger";
import {
  createRecordRepository,
  type WithFiles,
} from "~/modules/records/infrastructure/record-repository";
import type { Database } from "~/server/api/helpers";

export async function deleteRecordById(
  db: Database,
  withFiles: WithFiles,
  recordId: number,
) {
  const started = Date.now();
  try {
    const result = await withFiles(db, async (tx, files) => {
      const repository = createRecordRepository(tx);
      const record = await repository.requireEditableRecord(recordId);
      const fileId = await repository.listAttachmentFileId(recordId);
      if (fileId) await files.remove(fileId);
      await repository.deleteRecordRow(recordId);
      await repository.syncRecordTotal(record.taxItemId);
      return { success: true as const };
    });
    taxbookLog.info("record.delete", {
      outcome: "success",
      durationMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    taxbookLog.error("record.delete", {
      outcome: "failure",
      durationMs: Date.now() - started,
      message: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}
