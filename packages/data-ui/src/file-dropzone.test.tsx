import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Upload } from "./upload";
import { FileDropzone } from "./file-dropzone";

const source = new File(["%PDF-1.7"], "Chequing March.pdf");

function render(upload: Partial<Upload>) {
  return renderToStaticMarkup(
    <FileDropzone
      id="statement-file"
      accept=".pdf"
      upload={{
        status: "idle",
        source: null,
        progress: 0,
        file: null,
        error: null,
        upload: () => Promise.resolve(null),
        reset: () => undefined,
        ...upload,
      }}
    />,
  );
}

describe("FileDropzone", () => {
  it("offers to drop or choose a file", () => {
    const html = render({});
    expect(html).toMatch(/<input[^>]*id="statement-file"[^>]*type="file"/);
    expect(html).toContain('accept=".pdf"');
    expect(html).toContain("Drop a file here, or");
    expect(html).toMatch(/<button[^>]*>Choose a file<\/button>/);
  });

  it("shows progress while uploading", () => {
    const html = render({ status: "uploading", source, progress: 0.423 });
    expect(html).toContain("Chequing March.pdf");
    expect(html).toContain("Uploading… 42%");
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toMatch(/<button[^>]*>Remove<\/button>/);
    expect(html).not.toContain("Choose a file");
  });

  it("shows the uploaded file's size", () => {
    const html = render({
      status: "uploaded",
      source,
      progress: 1,
      file: {
        token: "document:4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d",
        name: "Chequing March.pdf",
        size: 2048,
        mimeType: "application/pdf",
      },
    });
    expect(html).toContain("2.0 KB · Uploaded");
    expect(html).not.toContain('role="progressbar"');
    expect(html).toMatch(/<button[^>]*>Replace<\/button>/);
  });

  it("shows why an upload failed", () => {
    const html = render({ status: "failed", source, error: "Upload a PDF." });
    expect(html).toContain("Not uploaded");
    expect(html).toContain(
      '<p role="alert" class="text-destructive text-xs">Upload a PDF.</p>',
    );
  });
});
