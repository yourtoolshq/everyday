import { describe, expect, it } from "vitest";

import { MAX_TAX_DOCUMENT_ATTACHMENT_BYTES } from "~/domain/tax-document";
import {
  parseCreateTaxDocumentForm,
  parseUpdateTaxDocumentForm,
} from "./tax-document-http";

function validForm() {
  const form = new FormData();
  form.set("taxItemId", "1");
  form.set("type", "t4");
  form.set("customTypeName", "");
  form.set("issuer", "Example employer");
  form.set("personId", "");
  form.set("notes", "Fictional note");
  return form;
}

describe("Tax Document multipart input", () => {
  it("accepts supported attachments and normalizes fields", async () => {
    const form = validForm();
    form.set("attachment", new File(["fictional"], "fictional-t4.pdf", { type: "application/pdf" }));
    const parsed = await parseCreateTaxDocumentForm(form);
    expect(parsed.input).toMatchObject({
      taxItemId: 1,
      type: "t4",
      customTypeName: null,
      issuer: "Example employer",
      personId: null,
    });
    expect(parsed.attachment).toMatchObject({
      fileName: "fictional-t4.pdf",
      mimeType: "application/pdf",
      sizeBytes: 9,
    });
  });

  it("requires issuer and a custom name for Other", async () => {
    const missingIssuer = validForm();
    missingIssuer.set("issuer", "");
    await expect(parseCreateTaxDocumentForm(missingIssuer)).rejects.toBeDefined();

    const other = validForm();
    other.set("type", "other");
    await expect(parseCreateTaxDocumentForm(other)).rejects.toBeDefined();
  });

  it("rejects unsupported, oversized, and invalid update attachments", async () => {
    const unsupported = validForm();
    unsupported.set("attachment", new File(["fictional"], "fictional.txt", { type: "text/plain" }));
    await expect(parseCreateTaxDocumentForm(unsupported)).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const oversized = validForm();
    oversized.set("attachment", new File([new Uint8Array(MAX_TAX_DOCUMENT_ATTACHMENT_BYTES + 1)], "large.png", { type: "image/png" }));
    await expect(parseCreateTaxDocumentForm(oversized)).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });

    const invalidAction = validForm();
    invalidAction.set("status", "received");
    invalidAction.set("attachmentAction", "unknown");
    await expect(parseUpdateTaxDocumentForm(invalidAction)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
