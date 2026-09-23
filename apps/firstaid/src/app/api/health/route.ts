import { createHealthResponse } from "~/server/health";

export const dynamic = "force-dynamic";

export async function GET() {
  return createHealthResponse();
}
