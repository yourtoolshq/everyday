import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FilePreview, filePreviewUrl, fileUrl } from "./file-preview";

const id = "4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d";

describe("fileUrl", () => {
  it("builds inline and download URLs", () => {
    expect(fileUrl(id)).toBe(`/api/data/files/${id}`);
    expect(fileUrl(id, { download: true })).toBe(
      `/api/data/files/${id}?download=1`,
    );
  });
});

describe("filePreviewUrl", () => {
  it("opens emails in the viewer page", () => {
    expect(filePreviewUrl({ id, mimeType: "message/rfc822" })).toBe(
      `/files/${id}`,
    );
  });

  it("serves files the browser can show inline", () => {
    for (const mimeType of ["application/pdf", "image/png", "audio/mpeg"]) {
      expect(filePreviewUrl({ id, mimeType })).toBe(`/api/data/files/${id}`);
    }
  });

  it("downloads other files", () => {
    expect(filePreviewUrl({ id, mimeType: "application/zip" })).toBe(
      `/api/data/files/${id}?download=1`,
    );
  });
});

describe("FilePreview", () => {
  it("opens the preview in a new tab", () => {
    const html = renderToStaticMarkup(
      <FilePreview
        file={{ id, mimeType: "message/rfc822" }}
        aria-label="Open notice"
      >
        Notice
      </FilePreview>,
    );
    expect(html).toBe(
      `<a href="/files/${id}" target="_blank" rel="noreferrer" aria-label="Open notice">Notice</a>`,
    );
  });
});
