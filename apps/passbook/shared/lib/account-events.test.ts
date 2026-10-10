import { describe, expect, it } from "vitest";

import {
  activityAttachmentDocumentType,
  updateAccountEventInputSchema,
} from "~/lib/account-events";

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

describe("activity updates", () => {
  it("accepts a terms change added after an activity was created", () => {
    const result = updateAccountEventInputSchema.safeParse({
      id: "7a384f61-43f2-4a7c-bd94-6a484cbb8d4d",
      type: "opening",
      title: "Account opening",
      startDate: "2026-01-15",
      resolvedDate: null,
      notes: null,
      termsChange: {
        recordTermsChange: true,
        effectiveDate: "2026-01-15",
        snapshotNotes: "Opening offer",
        terms: { creditLimit: "5000" },
      },
    });

    expect(result.success).toBe(true);
  });
});
