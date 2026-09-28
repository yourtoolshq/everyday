import { passbookLog } from "~/core/infrastructure/logger";
import type { CreateInstitutionCommand } from "~/modules/institutions/domain/institution-values";
import type { InstitutionRepository } from "~/modules/institutions/infrastructure/institution-repository";

export async function createInstitution(
  repository: InstitutionRepository,
  input: CreateInstitutionCommand,
) {
  const started = Date.now();
  try {
    const institution = await repository.create(input);
    passbookLog.info("institution.create", {
      outcome: "success",
      durationMs: Date.now() - started,
    });
    return institution;
  } catch (error) {
    passbookLog.error("institution.create", {
      outcome: "failure",
      durationMs: Date.now() - started,
      message: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}
