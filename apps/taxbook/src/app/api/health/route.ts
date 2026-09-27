import { createHealthResponse } from "~/server/health";

export const runtime = "nodejs";

export async function GET() {
  return createHealthResponse();
}
