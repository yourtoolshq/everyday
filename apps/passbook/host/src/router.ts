import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createDataHandlers } from "@yourtoolshq/data/next";

import type { HostRequestContext } from "./auth/middleware";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { dataPlatform } from "~/server/data";
import { fileRouter } from "~/server/files";
import { createHealthResponse } from "~/server/health";
import { authorizeRequest } from "./auth/middleware";
import { requiresRemoteAuth } from "./auth/policy";
import { handleAuthRoute } from "./auth/routes";
import { createAuthStore } from "./auth/store";
import { serveClientAsset } from "./static-client";

const dataHandlers = createDataHandlers(dataPlatform, { fileRouter });
const authStore = createAuthStore(process.env.DATA_DIR ?? "./.data");

function dataPathParts(pathname: string) {
  const prefix = "/api/data/";
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  return rest.length > 0 ? rest.split("/") : [];
}

function isAuthRoute(pathname: string) {
  return pathname.startsWith("/api/auth/");
}

export async function handleHostRequest(input: HostRequestContext) {
  const { request } = input;
  const { pathname } = new URL(request.url);

  const authResult = await authorizeRequest(authStore, input);
  if (authResult.error) return authResult.error;
  const authContext = authResult.context;

  if (pathname === "/api/health") {
    const health = await createHealthResponse();
    if (requiresRemoteAuth(authContext) && !authContext.tokenId) {
      const body = (await health.json()) as { status?: string };
      return Response.json({
        status: body.status ?? "ok",
        auth: "required",
      });
    }
    return health;
  }

  if (isAuthRoute(pathname)) {
    return handleAuthRoute(authStore, request, authContext);
  }

  if (pathname === "/api/trpc" || pathname.startsWith("/api/trpc/")) {
    return fetchRequestHandler({
      endpoint: "/api/trpc",
      req: request,
      router: appRouter,
      createContext: () =>
        createTRPCContext({
          headers: request.headers,
        }),
      onError:
        process.env.NODE_ENV === "development"
          ? ({ path, error }) => {
              console.error(
                `tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
              );
            }
          : undefined,
    });
  }

  const path = dataPathParts(pathname);
  if (path) {
    const routeContext = { params: Promise.resolve({ path }) };
    if (request.method === "GET") {
      return dataHandlers.GET(request, routeContext);
    }
    if (request.method === "POST") {
      return dataHandlers.POST(request, routeContext);
    }
    return new Response("Method Not Allowed", { status: 405 });
  }

  return (
    (await serveClientAsset(request)) ??
    new Response("Not Found", { status: 404 })
  );
}
