import { checkDatabaseConnection } from "~/server/db";

type HealthCheck = () => Promise<void>;

export async function createHealthResponse(
  healthCheck: HealthCheck = checkDatabaseConnection,
) {
  try {
    await healthCheck();
    return Response.json({ status: "ok" as const });
  } catch {
    return Response.json({ status: "error" as const }, { status: 503 });
  }
}
