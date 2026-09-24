import { z } from "zod";

import type { FileTypeGroup } from "./detect";

type ByteSize = number | `${number}KB` | `${number}MB`;

export interface FileRoute {
  types: readonly FileTypeGroup[];
  maxBytes: number;
}

export type FileRouter = Record<string, FileRoute>;

const endpointPattern = /^[A-Za-z][A-Za-z0-9]*$/;
const uuidPattern =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const tokenPattern = new RegExp(`^([A-Za-z][A-Za-z0-9]*):(${uuidPattern})$`);

const typeDescriptions: Record<FileTypeGroup, string> = {
  pdf: "a PDF",
  image: "an image",
  eml: "an .eml file",
  audio: "a common audio file (MP3, M4A, WAV, OGG)",
};

export function file(options: {
  types: FileTypeGroup[];
  maxBytes: ByteSize;
}): FileRoute {
  return { types: options.types, maxBytes: parseByteSize(options.maxBytes) };
}

export function createFileRouter<TRouter extends FileRouter>(
  routes: TRouter,
): TRouter {
  for (const endpoint of Object.keys(routes)) {
    if (!endpointPattern.test(endpoint)) {
      throw new Error(`Invalid file endpoint name: ${endpoint}`);
    }
  }
  return routes;
}

export function fileToken(endpoint: string) {
  return z
    .string()
    .refine(
      (token) => parseFileToken(token)?.endpoint === endpoint,
      "Upload the file again.",
    );
}

export function createFileTokenValue(endpoint: string, id: string) {
  return `${endpoint}:${id}`;
}

export function parseFileToken(token: string) {
  const match = tokenPattern.exec(token);
  if (!match?.[1] || !match[2]) return null;
  return { endpoint: match[1], id: match[2] };
}

export function describeAllowedTypes(types: readonly FileTypeGroup[]) {
  const list = new Intl.ListFormat("en", { type: "disjunction" }).format(
    types.map((type) => typeDescriptions[type]),
  );
  return `Upload ${list}.`;
}

export function formatByteLimit(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  if (Number.isInteger(megabytes)) return `${megabytes} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function parseByteSize(size: ByteSize) {
  if (typeof size === "number") return size;
  const value = Number(size.slice(0, -2));
  return size.endsWith("MB") ? value * 1024 * 1024 : value * 1024;
}
