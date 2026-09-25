import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { uploadFile } from "./upload";

interface ProgressEventInit {
  lengthComputable: boolean;
  loaded: number;
  total: number;
}

class FakeRequest {
  static last: FakeRequest;
  method = "";
  url = "";
  responseType = "";
  body: FormData | null = null;
  status = 0;
  response: unknown = null;
  aborted = false;
  upload: { onprogress: ((event: ProgressEventInit) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeRequest.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  send(body: FormData) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  respond(status: number, response: unknown) {
    this.status = status;
    this.response = response;
    this.onload?.();
  }
}

const file = new File(["%PDF-1.7"], "Chequing March.pdf");
const staged = {
  token: "document:4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d",
  name: "Chequing March.pdf",
  size: 8,
  mimeType: "application/pdf",
};

beforeEach(() => {
  vi.stubGlobal("XMLHttpRequest", FakeRequest);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadFile", () => {
  it("posts the file to the endpoint and returns the staged upload", async () => {
    const uploaded = uploadFile("document", file);
    const request = FakeRequest.last;
    expect(request.method).toBe("POST");
    expect(request.url).toBe("/api/data/upload/document");
    expect(request.responseType).toBe("json");
    expect(request.body?.get("file")).toBeInstanceOf(File);

    request.respond(201, staged);
    await expect(uploaded).resolves.toEqual(staged);
  });

  it("reports progress when the size is known", async () => {
    const onProgress = vi.fn();
    const uploaded = uploadFile("document", file, { onProgress });
    const request = FakeRequest.last;
    request.upload.onprogress?.({
      lengthComputable: false,
      loaded: 2,
      total: 0,
    });
    request.upload.onprogress?.({
      lengthComputable: true,
      loaded: 2,
      total: 8,
    });
    request.respond(201, staged);
    await uploaded;

    expect(onProgress.mock.calls).toEqual([[0.25]]);
  });

  it("throws the server's error message", async () => {
    const uploaded = uploadFile("document", file);
    FakeRequest.last.respond(415, { error: "Upload a PDF." });
    await expect(uploaded).rejects.toThrow("Upload a PDF.");
  });

  it("throws a generic message when the response is not JSON", async () => {
    const uploaded = uploadFile("document", file);
    FakeRequest.last.respond(500, null);
    await expect(uploaded).rejects.toThrow("The file could not be uploaded.");
  });

  it("throws when the connection fails", async () => {
    const uploaded = uploadFile("document", file);
    FakeRequest.last.onerror?.();
    await expect(uploaded).rejects.toThrow(
      "The file could not be uploaded. Check the connection.",
    );
  });

  it("stops the request when the signal aborts", async () => {
    const controller = new AbortController();
    const uploaded = uploadFile("document", file, {
      signal: controller.signal,
    });
    controller.abort();

    expect(FakeRequest.last.aborted).toBe(true);
    await expect(uploaded).rejects.toMatchObject({ name: "AbortError" });
  });
});
