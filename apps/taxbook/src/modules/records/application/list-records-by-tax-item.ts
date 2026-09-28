import type { RecordRepository } from "~/modules/records/infrastructure/record-repository";
import { taxbookLog } from "~/core/infrastructure/logger";

export async function listRecordsByTaxItem(
  repository: RecordRepository,
  taxItemId: number,
) {
  const started = Date.now();
  try {
    const result = await repository.listByTaxItem(taxItemId);
    taxbookLog.info("record.listByTaxItem", {
      outcome: "success",
      durationMs: Date.now() - started,
      count: result.items.length,
    });
    return result;
  } catch (error) {
    taxbookLog.error("record.listByTaxItem", {
      outcome: "failure",
      durationMs: Date.now() - started,
      message: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}
