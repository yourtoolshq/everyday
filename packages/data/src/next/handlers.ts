import { createReadStream } from "node:fs";
import { basename } from "node:path";
import { Readable } from "node:stream";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import type { FileRouter } from "../files/router";
import type { DataPlatform } from "../platform";
import { detectFileType } from "../files/detect";
import { describeAllowedTypes, formatByteLimit } from "../files/router";
import { createDataRouter } from "../router";

export const trpcEndpoint = "/api/data/trpc";

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Multipart framing and form fields around the file.
const formOverheadBytes = 1024 * 1024;

export function createDataHandlers(
  platform: DataPlatform,
  options: { fileRouter: FileRouter },
) {
  const router = createDataRouter(platform);

  function handleTrpc(request: Request) {
    return fetchRequestHandler({
      endpoint: trpcEndpoint,
      req: request,
      router,
      createContext: () => ({}),
      onError({ path, error }) {
        if (error.code !== "INTERNAL_SERVER_ERROR") return;
        console.error("data request failed", { path, error });
      },
    });
  }

  async function GET(request: Request, context: RouteContext) {
    const [resource, id, ...rest] = (await context.params).path ?? [];
    if (resource === "trpc") return handleTrpc(request);
    if (resource === "files" && id && rest.length === 0) {
      const download = new URL(request.url).searchParams.get("download");
      return serveFile(platform, id, download === "1");
    }
    if (resource === "backups" && id && rest.length === 0) {
      return serveBackup(platform, id);
    }
    return errorResponse("Not found", 404);
  }

  async function POST(request: Request, context: RouteContext) {
    const [resource, endpoint, ...rest] = (await context.params).path ?? [];
    if (resource === "trpc") {
      // Only JSON mutations: a cross-site form can send multipart bodies without a
      // CORS preflight, and tRPC would run the mutation with them.
      const type = request.headers.get("content-type") ?? "";
      if (!type.startsWith("application/json")) {
        return errorResponse("Send data requests as application/json.", 415);
      }
      return handleTrpc(request);
    }
    if (resource === "upload" && endpoint && rest.length === 0) {
      return upload(platform, options.fileRouter, endpoint, request);
    }
    return errorResponse("Not found", 404);
  }

  return { GET, POST };
}

async function upload(
  platform: DataPlatform,
  fileRouter: FileRouter,
  endpoint: string,
  request: Request,
) {
  const route = Object.hasOwn(fileRouter, endpoint)
    ? fileRouter[endpoint]
    : undefined;
  if (!route) return errorResponse("Unknown upload endpoint.", 404);

  const tooLarge = `The file must be ${formatByteLimit(route.maxBytes)} or smaller.`;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > route.maxBytes + formOverheadBytes) {
    return errorResponse(tooLarge, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("The upload could not be read.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return errorResponse("Choose a non-empty file.", 400);
  }
  if (file.size > route.maxBytes) return errorResponse(tooLarge, 413);

  const originalFilename = safeOriginalFilename(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectFileType(bytes, originalFilename);
  if (!type || !route.types.includes(type.group)) {
    return errorResponse(describeAllowedTypes(route.types), 415);
  }

  const staged = await platform.files.stage({
    endpoint,
    originalFilename,
    bytes,
    type,
  });
  return Response.json(staged, { status: 201 });
}

async function serveFile(
  platform: DataPlatform,
  fileId: string,
  download: boolean,
) {
  if (!uuidPattern.test(fileId)) return errorResponse("Not found", 404);
  const found = await platform.files.stream(fileId);
  if (!found) return errorResponse("File not found", 404);
  return new Response(found.body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": contentDisposition(
        found.file.originalFilename,
        download ? "attachment" : "inline",
      ),
      "Content-Length": String(found.size),
      "Content-Type": found.file.mimeType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function serveBackup(platform: DataPlatform, id: string) {
  const backup = await platform.backups.find(id);
  if (!backup) return errorResponse("Backup not found", 404);
  return new Response(
    Readable.toWeb(createReadStream(backup.path)) as ReadableStream,
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(
          `${backup.id}.ytbackup`,
          "attachment",
        ),
        "Content-Length": String(backup.size),
        "Content-Type": "application/x-tar",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function safeOriginalFilename(filename: string) {
  const normalized = basename(filename.replaceAll("\\", "/"))
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return (normalized || "file").slice(0, 255);
}

function contentDisposition(
  filename: string,
  disposition: "inline" | "attachment",
) {
  const fallback = filename
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function errorResponse(error: string, status: number) {
  return Response.json({ error }, { status });
}
