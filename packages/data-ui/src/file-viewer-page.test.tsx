import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DataGate } from "./data-gate";
import { FileViewerPage, StoredFileViewer } from "./file-viewer-page";

const id = "4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d";

function storedFile(mimeType: string, content: string) {
  return {
    read: (fileId: string) =>
      Promise.resolve(
        fileId === id
          ? {
              file: { id, mimeType, originalFilename: "fee-update.eml" },
              bytes: Buffer.from(content),
            }
          : null,
      ),
  } as unknown as Parameters<typeof StoredFileViewer>[0]["files"];
}

async function render(files: ReturnType<typeof storedFile>) {
  return renderToStaticMarkup(await StoredFileViewer({ files, fileId: id }));
}

const htmlEmail = [
  "From: Bank <noreply@example.com>",
  "To: You <you@example.com>",
  "Subject: Fee schedule update",
  "Date: Mon, 12 May 2025 14:22:00 -0400",
  'Content-Type: multipart/mixed; boundary="outer"',
  "",
  "--outer",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<p>Your fee schedule changes on October 1.</p>",
  "--outer",
  'Content-Type: application/pdf; name="schedule.pdf"',
  'Content-Disposition: attachment; filename="schedule.pdf"',
  "Content-Transfer-Encoding: base64",
  "",
  "JVBERi0xLjQ=",
  "--outer--",
].join("\r\n");

describe("FileViewerPage", () => {
  it("shows the viewer only once the data is ready", async () => {
    const files = storedFile("message/rfc822", htmlEmail);
    const status = (state: "ready" | "restoring") => () =>
      Promise.resolve({ app: "passbook", version: null, state });
    const gate = FileViewerPage({
      platform: { status: status("restoring"), files },
      fileId: id,
    }) as ReactElement<Parameters<typeof DataGate>[0]>;

    const blocked = await DataGate(gate.props);
    expect(renderToStaticMarkup(blocked)).toContain("Restoring a backup");

    const ready = await DataGate({
      ...gate.props,
      platform: { status: status("ready") },
    });
    expect((ready as ReactElement).type).toBe(StoredFileViewer);
  });
});

describe("StoredFileViewer", () => {
  it("shows an email's headers, sandboxed body and attachments", async () => {
    const html = await render(storedFile("message/rfc822", htmlEmail));
    expect(html).toContain("<h1");
    expect(html).toContain("Fee schedule update</h1>");
    expect(html).toContain("<dt");
    expect(html).toContain("Bank &lt;noreply@example.com&gt;</dd>");
    expect(html).toContain("You &lt;you@example.com&gt;</dd>");
    expect(html).toContain('dateTime="2025-05-12T18:22:00.000Z"');
    expect(html).toContain('sandbox=""');
    expect(html).toContain(
      'srcDoc="&lt;p&gt;Your fee schedule changes on October 1.&lt;/p&gt;"',
    );
    expect(html).toContain("schedule.pdf</span>");
    expect(html).toContain("8 B</span>");
    expect(html).toContain(`href="/api/data/files/${id}?download=1"`);
  });

  it("shows a plain-text email under its filename when it has no subject", async () => {
    const html = await render(
      storedFile(
        "message/rfc822",
        "From: a@example.com\r\nDate: sometime\r\nContent-Type: text/plain\r\n\r\nHello there\r\n",
      ),
    );
    expect(html).toContain("fee-update.eml</h1>");
    expect(html).toContain("Hello there</pre>");
    expect(html).toContain("sometime</span>");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("Attachments");
  });

  it("sends other files to the file itself", async () => {
    await expect(
      render(storedFile("application/pdf", "%PDF-1.4")),
    ).rejects.toMatchObject({
      digest: expect.stringContaining(`;/api/data/files/${id};`) as unknown,
    });
  });

  it("is not found when the file does not exist", async () => {
    await expect(
      StoredFileViewer({
        files: storedFile("message/rfc822", ""),
        fileId: "missing",
      }),
    ).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });
});
