import { createDataHandlers } from "@yourtoolshq/data/next";

import { dataPlatform } from "~/server/data";
import { databaseReady } from "~/server/db";
import { fileRouter } from "~/server/files";

export const runtime = "nodejs";

const handlers = createDataHandlers(dataPlatform, { fileRouter });

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: RouteContext) {
  await databaseReady;
  return handlers.GET(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  await databaseReady;
  return handlers.POST(request, context);
}
