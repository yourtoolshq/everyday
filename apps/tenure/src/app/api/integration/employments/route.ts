import { NextResponse } from "next/server";

import { listIntegrationEmployments } from "~/server/integration";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listIntegrationEmployments();
  return NextResponse.json({ items });
}
