import type { PaycheckRepository } from "~/modules/paychecks/infrastructure/paycheck-repository";
import { tenureLog } from "~/core/infrastructure/logger";

export async function listPaychecksByEmployment(
  repository: PaycheckRepository,
  employmentId: string,
) {
  const started = Date.now();
  try {
    const items = await repository.listByEmployment(employmentId);
    tenureLog.info("paycheck.listByEmployment", {
      outcome: "success",
      durationMs: Date.now() - started,
      count: items.length,
    });
    return items;
  } catch (error) {
    tenureLog.error("paycheck.listByEmployment", {
      outcome: "failure",
      durationMs: Date.now() - started,
      message: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}
