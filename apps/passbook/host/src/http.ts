import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { Socket } from "node:net";

import type { HostRequestContext } from "./auth/middleware";

export interface HostHttpOptions {
  host: string;
  port: number;
  handler: (input: HostRequestContext) => Promise<Response>;
}

function readRequestBody(req: IncomingMessage) {
  if (req.method === "GET" || req.method === "HEAD") return Promise.resolve();
  const chunks: Buffer[] = [];
  return new Promise<Buffer | undefined>((resolve, reject) => {
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () =>
      resolve(chunks.length > 0 ? Buffer.concat(chunks) : undefined),
    );
    req.on("error", reject);
  });
}

async function toFetchRequest(req: IncomingMessage, baseUrl: string) {
  const url = new URL(req.url ?? "/", baseUrl);
  const body = await readRequestBody(req);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined)
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const init: RequestInit = {
    method: req.method,
    headers,
  };
  if (body) init.body = body;
  return new Request(url, init);
}

async function sendResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const body = await response.arrayBuffer();
  res.end(Buffer.from(body));
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !isLoopbackOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, content-type, trpc-accept, trpc-batch-mode, x-trpc-source",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function isLoopbackOrigin(origin: string) {
  try {
    const { hostname, protocol } = new URL(origin);
    return (
      (protocol === "http:" || protocol === "https:") &&
      (hostname === "127.0.0.1" ||
        hostname === "localhost" ||
        hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

export function createHostHttpServer(options: HostHttpOptions) {
  const baseUrl = `http://${options.host}:${options.port}`;

  const server = createServer((req, res) => {
    void (async () => {
      try {
        if (req.method === "OPTIONS") {
          const headers = corsHeaders(req.headers.origin ?? null);
          res.writeHead(204, headers);
          res.end();
          return;
        }

        const request = await toFetchRequest(req, baseUrl);
        const remoteAddress = req.socket.remoteAddress ?? "127.0.0.1";
        const response = await options.handler({ request, remoteAddress });
        const headers = new Headers(response.headers);
        const origin = request.headers.get("origin");
        for (const [key, value] of Object.entries(corsHeaders(origin))) {
          headers.set(key, value);
        }
        await sendResponse(
          res,
          new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          }),
        );
      } catch (error) {
        console.error("host request failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("Internal Server Error");
        }
      }
    })();
  });

  return server;
}

export function listenHostServer(
  server: Server,
  options: Pick<HostHttpOptions, "host" | "port">,
) {
  return new Promise<{ port: number }>((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${options.port} is already in use on ${options.host}. Stop the other Passbook host or set PORT to a free value.`,
          ),
        );
        return;
      }
      if (error.code === "EACCES") {
        reject(
          new Error(
            `Cannot bind to ${options.host}:${options.port}. Choose a different PORT or HOST.`,
          ),
        );
        return;
      }
      reject(error);
    });
    server.listen(
      { port: options.port, host: options.host, exclusive: false },
      () => {
        const address = server.address();
        const port =
          typeof address === "object" && address ? address.port : options.port;
        resolve({ port });
      },
    );
  });
}

export async function closeHostServer(server: Server, timeoutMs = 10_000) {
  const connections = new Set<Socket>();
  server.on("connection", (socket) => {
    connections.add(socket);
    socket.on("close", () => connections.delete(socket));
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      for (const socket of connections) socket.destroy();
      reject(
        new Error("Host shutdown timed out waiting for in-flight requests."),
      );
    }, timeoutMs);

    server.close((error) => {
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    });
  });
}
