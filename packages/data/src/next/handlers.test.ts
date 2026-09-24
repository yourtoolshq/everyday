import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFileRouter, file } from "../files/router";
import { createTestPlatform, pdfBytes } from "../test-platform";
import { createDataHandlers } from "./handlers";

let context: Awaited<ReturnType<typeof createTestPlatform>>;
let handlers: ReturnType<typeof createDataHandlers>;

const fileRouter = createFileRouter({
  statement: file({ types: ["pdf"], maxBytes: "1KB" }),
});

const params = (...path: string[]) => ({ params: Promise.resolve({ path }) });

function uploadRequest(body: FormData, endpoint = "statement") {
  return handlers.POST(
    new Request(`http://localhost/api/data/upload/${endpoint}`, {
      method: "POST",
      body,
    }),
    params("upload", endpoint),
  );
}

function formWith(bytes: Uint8Array, name: string) {
  const form = new FormData();
  form.set("file", new File([bytes], name));
  return form;
}

async function uploadAndClaim(name = "Chequing March.pdf") {
  const response = await uploadRequest(formWith(pdfBytes, name));
  const { token } = (await response.json()) as { token: string };
  return context.platform.files.withFiles(context.db, (_tx, files) =>
    files.claim(token),
  );
}

beforeEach(async () => {
  context = await createTestPlatform();
  handlers = createDataHandlers(context.platform, { fileRouter });
});

afterEach(async () => {
  await context.cleanup();
});

describe("POST upload/:endpoint", () => {
  it("stages a valid file and returns its token", async () => {
    const response = await uploadRequest(
      formWith(pdfBytes, "C:\\Users\\sample\\Chequing\u0007 March.pdf"),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      token: expect.stringMatching(/^statement:/) as unknown,
      name: "Chequing March.pdf",
      size: pdfBytes.byteLength,
      mimeType: "application/pdf",
    });
  });

  it.each([
    ["unknown endpoint", formWith(pdfBytes, "a.pdf"), "voiceNote", 404],
    ["empty file", formWith(new Uint8Array(), "a.pdf"), "statement", 400],
    [
      "oversized file",
      formWith(new Uint8Array(2048).fill(0x25), "a.pdf"),
      "statement",
      413,
    ],
    [
      "disallowed type",
      formWith(new TextEncoder().encode("hello"), "a.txt"),
      "statement",
      415,
    ],
    ["missing file field", new FormData(), "statement", 400],
  ])("rejects %s", async (_name, form, endpoint, status) => {
    const response = await uploadRequest(form, endpoint);
    expect(response.status).toBe(status);
    expect(await response.json()).toHaveProperty("error");
  });

  it("does not treat inherited properties as endpoints", async () => {
    const response = await uploadRequest(
      formWith(pdfBytes, "a.pdf"),
      "constructor",
    );
    expect(response.status).toBe(404);
  });

  it("explains which types are allowed", async () => {
    const response = await uploadRequest(
      formWith(new TextEncoder().encode("hello"), "a.txt"),
    );
    expect(await response.json()).toEqual({ error: "Upload a PDF." });
  });
});

describe("GET files/:id", () => {
  it("serves a stored file inline", async () => {
    const stored = await uploadAndClaim("Relevé März.pdf");

    const response = await handlers.GET(
      new Request(`http://localhost/api/data/files/${stored.id}`),
      params("files", stored.id),
    );

    expect(response.status).toBe(200);
    expect(Object.fromEntries(response.headers)).toMatchObject({
      "cache-control": "private, no-store",
      "content-disposition": `inline; filename="Relev_ M_rz.pdf"; filename*=UTF-8''Relev%C3%A9%20M%C3%A4rz.pdf`,
      "content-length": String(pdfBytes.byteLength),
      "content-type": "application/pdf",
      "x-content-type-options": "nosniff",
    });
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pdfBytes);
  });

  it("serves a download when requested", async () => {
    const stored = await uploadAndClaim();

    const response = await handlers.GET(
      new Request(`http://localhost/api/data/files/${stored.id}?download=1`),
      params("files", stored.id),
    );

    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; /,
    );
  });

  it.each([
    ["an unknown file", ["files", "4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d"]],
    ["a non-uuid id", ["files", "..%2Fpassbook.db"]],
    ["an unknown resource", ["backups"]],
    [
      "extra path segments",
      ["files", "4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d", "x"],
    ],
  ])("returns 404 for %s", async (_name, path) => {
    const response = await handlers.GET(
      new Request("http://localhost/api/data/files"),
      params(...path),
    );
    expect(response.status).toBe(404);
  });
});
