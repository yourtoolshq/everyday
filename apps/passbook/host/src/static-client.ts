import { readFile } from "node:fs/promises";
import path from "node:path";

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function responseForFile(file: string) {
  return readFile(file)
    .then(
      (body) =>
        new Response(body, {
          headers: {
            "Content-Type":
              contentTypes[path.extname(file)] ?? "application/octet-stream",
          },
        }),
    )
    .catch(() => null);
}

export async function serveClientAsset(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const clientDist = process.env.PASSBOOK_CLIENT_DIST;
  const { pathname } = new URL(request.url);
  if (!clientDist || pathname.startsWith("/api/")) return null;

  const requestedPath = pathname === "/" ? "index.html" : pathname.slice(1);
  const resolved = path.resolve(clientDist, requestedPath);
  if (
    path.relative(clientDist, resolved).startsWith("..") ||
    path.isAbsolute(path.relative(clientDist, resolved))
  ) {
    return new Response("Not Found", { status: 404 });
  }

  const asset = await responseForFile(resolved);
  if (asset)
    return request.method === "HEAD" ? new Response(null, asset) : asset;

  if (!path.extname(requestedPath)) {
    const index = await responseForFile(path.join(clientDist, "index.html"));
    if (index)
      return request.method === "HEAD" ? new Response(null, index) : index;
  }

  return new Response("Not Found", { status: 404 });
}
