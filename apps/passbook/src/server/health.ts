import { dataPlatform } from "~/server/data";
import { checkDatabaseConnection } from "~/server/db";

type HealthCheck = () => Promise<void>;

// Upgrading, restoring, and blocked answer 200: Traefik routes only to healthy
// containers, and the maintenance screen has to stay reachable.
export async function createHealthResponse(
  healthCheck: HealthCheck = checkDatabaseConnection,
) {
  const { state } = await dataPlatform.state();
  if (state !== "ready") {
    return Response.json({ status: "maintenance" as const, state });
  }
  try {
    await healthCheck();
    return Response.json({ status: "ok" as const, state });
  } catch (error) {
    console.error("health check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ status: "error" as const, state }, { status: 503 });
  }
}
