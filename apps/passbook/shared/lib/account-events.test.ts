import { describe, expect, it } from "vitest";

import { activityAttachmentDocumentType } from "~/lib/account-events";

describe("activity attachments", () => {
  it("classifies opening activity files by type", () => {
    const pdf = new File(["pdf"], "agreement.pdf", { type: "application/pdf" });
    const eml = new File(["email"], "welcome.eml", { type: "message/rfc822" });

    expect(activityAttachmentDocumentType("opening", pdf)).toBe(
      "opening_document",
    );
    expect(activityAttachmentDocumentType("opening", eml)).toBe(
      "financial_correspondence",
    );
    expect(activityAttachmentDocumentType("phone_call", pdf)).toBe(
      "financial_correspondence",
    );
  });
});
