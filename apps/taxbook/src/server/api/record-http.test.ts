import { describe, expect, it } from "vitest";

import { MAX_ATTACHMENT_BYTES } from "~/domain/record";
import {
  parseCreateRecordForm,
  parseUpdateRecordForm,
} from "./record-http";

function validForm() {
  const form = new FormData();
  form.set("taxItemId", "1");
  form.set("date", "2025-12-15");
  form.set("description", "Fictional supporting expense");
  form.set("amountCents", "12500");
  form.set("personId", "");
  form.set("notes", "Fictional note");
  return form;
}

describe("Record multipart input", () => {
  it("accepts a supported attachment and dates outside the tax year", async () => {
    const form = validForm();
    form.set(
      "attachment",
      new File(["fictional"], "fictional-receipt.pdf", {
        type: "application/pdf",
      }),
    );
    const parsed = await parseCreateRecordForm(form);
    expect(parsed.input).toMatchObject({
      taxItemId: 1,
      date: "2025-12-15",
      amountCents: 12500,
      personId: null,
    });
    expect(parsed.attachment).toMatchObject({
      fileName: "fictional-receipt.pdf",
      mimeType: "application/pdf",
      sizeBytes: 9,
    });
  });

  it("rejects unsupported and oversized attachments", async () => {
    const unsupported = validForm();
    unsupported.set(
      "attachment",
      new File(["fictional"], "fictional.txt", { type: "text/plain" }),
    );
    await expect(parseCreateRecordForm(unsupported)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    const oversized = validForm();
    oversized.set(
      "attachment",
      new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], "large.png", {
        type: "image/png",
      }),
    );
    await expect(parseCreateRecordForm(oversized)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
  });

  it("requires a positive amount and a valid attachment action", async () => {
    const invalidAmount = validForm();
    invalidAmount.set("amountCents", "0");
    await expect(parseCreateRecordForm(invalidAmount)).rejects.toBeDefined();

    const invalidAction = validForm();
    invalidAction.set("attachmentAction", "unknown");
    await expect(parseUpdateRecordForm(invalidAction)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
