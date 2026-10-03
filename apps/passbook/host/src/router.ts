import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createDataHandlers } from "@yourtoolshq/data/next";

import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { dataPlatform } from "~/server/data";
import { createHealthResponse } from "~/server/health";
import { fileRouter } from "~/server/files";

const dataHandlers = createDataHandlers(dataPlatform, { fileRouter });

function dataPathParts(pathname: string) {
  const prefix = "/api/data/";
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  return rest.length > 0 ? rest.split("/") : [];
}

export async function handleHostRequest(request: Request) {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/health") {
    return createHealthResponse();
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

  return new Response("Not Found", { status: 404 });
}
