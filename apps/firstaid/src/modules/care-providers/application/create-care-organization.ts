import type { CreateCareOrganizationCommand } from "~/modules/care-providers/domain/care-organization-values";
import type { CareProvidersRepository } from "~/modules/care-providers/infrastructure/care-providers-repository";
import { firstaidLog } from "~/core/infrastructure/logger";

export async function createCareOrganization(
  repository: CareProvidersRepository,
  input: CreateCareOrganizationCommand,
) {
  const started = Date.now();
  try {
    const organization = await repository.createOrganization(input);
    firstaidLog.info("careOrganization.create", {
      outcome: "success",
      durationMs: Date.now() - started,
    });
    return organization;
  } catch (error) {
    firstaidLog.error("careOrganization.create", {
      outcome: "failure",
      durationMs: Date.now() - started,
      message: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}
