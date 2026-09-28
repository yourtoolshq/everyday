import type { CreatePaycheckCommand } from "~/modules/paychecks/domain/paycheck-values";
import type { PaycheckRepository } from "~/modules/paychecks/infrastructure/paycheck-repository";
import { tenureLog } from "~/core/infrastructure/logger";
import { buildPaycheckWriteValues } from "~/modules/paychecks/domain/paycheck-values";

export async function createPaycheck(
  repository: PaycheckRepository,
  input: CreatePaycheckCommand,
) {
  const started = Date.now();
  try {
    const settings = await repository.getEmploymentDeductionSettings(
      input.employmentId,
    );
    const values = buildPaycheckWriteValues(input, settings);
    const paycheck = await repository.create({
      employmentId: input.employmentId,
      values,
    });
    tenureLog.info("paycheck.create", {
      outcome: "success",
      durationMs: Date.now() - started,
    });
    return paycheck;
  } catch (error) {
    tenureLog.error("paycheck.create", {
      outcome: "failure",
      durationMs: Date.now() - started,
      message: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}
