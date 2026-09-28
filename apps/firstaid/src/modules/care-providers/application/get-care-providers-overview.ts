import type { CareProvidersRepository } from "~/modules/care-providers/infrastructure/care-providers-repository";
import { firstaidLog } from "~/core/infrastructure/logger";

export async function getCareProvidersOverview(
  repository: CareProvidersRepository,
) {
  const started = Date.now();
  try {
    const [
      organizations,
      allProviders,
      organizationVisitCounts,
      providerVisitCounts,
    ] = await Promise.all([
      repository.listOrganizations(),
      repository.listProviders(),
      repository.countVisitsByOrganization(),
      repository.countVisitsByProvider(),
    ]);

    const organizationVisits = new Map(
      organizationVisitCounts.map((row) => [row.id, row.total]),
    );
    const providerVisits = new Map(
      providerVisitCounts.map((row) => [row.id, row.total]),
    );

    const result = {
      organizations: organizations.map((organization) => ({
        ...organization,
        providerCount: allProviders.filter(
          (provider) => provider.careOrganizationId === organization.id,
        ).length,
        visitCount: organizationVisits.get(organization.id) ?? 0,
      })),
      providers: allProviders.map((provider) => ({
        ...provider,
        visitCount: providerVisits.get(provider.id) ?? 0,
      })),
    };

    firstaidLog.info("careProviders.overview", {
      outcome: "success",
      durationMs: Date.now() - started,
      organizationCount: result.organizations.length,
      providerCount: result.providers.length,
    });
    return result;
  } catch (error) {
    firstaidLog.error("careProviders.overview", {
      outcome: "failure",
      durationMs: Date.now() - started,
      message: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}
