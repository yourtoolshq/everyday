import { passbookLog } from "~/core/infrastructure/logger";
import type { InstitutionRepository } from "~/modules/institutions/infrastructure/institution-repository";

export async function listInstitutions(repository: InstitutionRepository) {
  const started = Date.now();
  try {
    const items = await repository.list();
    passbookLog.info("institution.list", {
      outcome: "success",
      durationMs: Date.now() - started,
      count: items.length,
    });
    return items;
  } catch (error) {
    passbookLog.error("institution.list", {
      outcome: "failure",
      durationMs: Date.now() - started,
      message: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}
