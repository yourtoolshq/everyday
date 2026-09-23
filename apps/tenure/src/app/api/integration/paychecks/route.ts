import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { employments } from "~/server/db/schema";
import { listIntegrationPaychecks } from "~/server/integration";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const employmentId = params.get("employmentId");
  const updatedSince = params.get("updatedSince");

  if (!employmentId) {
    return NextResponse.json(
      { error: "employmentId is required." },
      { status: 400 },
    );
  }

  const [employment] = await db
    .select({ id: employments.id })
    .from(employments)
    .where(eq(employments.id, employmentId));

  if (!employment) {
    return NextResponse.json(
      { error: "Employment not found." },
      { status: 404 },
    );
  }

  const items = await listIntegrationPaychecks({
    employmentId,
    updatedSince: updatedSince ?? undefined,
  });

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      hasStub: item.hasStub !== null,
    })),
  });
}
