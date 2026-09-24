import { afterEach, describe, expect, it, vi } from "vitest";

import type { FileRoute } from "@yourtoolshq/data/files";

import { createUploadHelpers, fileUrl } from "./index";

const { uploadFile } = createUploadHelpers<{ document: FileRoute }>();
const file = new File(["%PDF-1.7"], "Chequing March.pdf");

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadFile", () => {
  it("posts the file to the endpoint and returns the staged upload", async () => {
    const staged = {
      token: "document:4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d",
      name: "Chequing March.pdf",
      size: 8,
      mimeType: "application/pdf",
    };
    const fetchMock = mockFetch(Response.json(staged, { status: 201 }));

    await expect(uploadFile("document", file)).resolves.toEqual(staged);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/data/upload/document");
    expect(init.method).toBe("POST");
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("throws the server's error message", async () => {
    mockFetch(Response.json({ error: "Upload a PDF." }, { status: 415 }));
    await expect(uploadFile("document", file)).rejects.toThrow("Upload a PDF.");
  });

  it("throws a generic message when the response is not JSON", async () => {
    mockFetch(new Response("Internal Server Error", { status: 500 }));
    await expect(uploadFile("document", file)).rejects.toThrow(
      "The file could not be uploaded.",
    );
  });
});

describe("fileUrl", () => {
  it("builds inline and download URLs", () => {
    const id = "4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d";
    expect(fileUrl(id)).toBe(`/api/data/files/${id}`);
    expect(fileUrl(id, { download: true })).toBe(
      `/api/data/files/${id}?download=1`,
    );
  });
});
