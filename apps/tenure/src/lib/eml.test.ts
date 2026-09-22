import { describe, expect, it } from "vitest";

import { listParsedEmlAddressFields, parseEml } from "~/lib/eml";

describe("parseEml", () => {
  it("parses a simple plain-text message", async () => {
    const raw = [
      "From: HR <hr@example.com>",
      "To: You <you@example.com>",
      "Subject: Salary review",
      "Date: Mon, 12 May 2025 14:22:00 -0400",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Your salary will increase effective June 1.",
    ].join("\n");

    const parsed = await parseEml(raw);
    expect(parsed.from).toBe("HR <hr@example.com>");
    expect(parsed.to).toBe("You <you@example.com>");
    expect(parsed.subject).toBe("Salary review");
    expect(parsed.body).toBe("Your salary will increase effective June 1.");
    expect(parsed.bodyContentType).toBe("text");
  });

  it("prefers html in multipart messages for preview", async () => {
    const raw = [
      "From: HR <hr@example.com>",
      "Subject: Offer update",
      'Content-Type: multipart/alternative; boundary="abc"',
      "",
      "--abc",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Plain body",
      "--abc",
      "Content-Type: text/html; charset=utf-8",
      "",
      "<p>HTML body</p>",
      "--abc--",
    ].join("\n");

    const parsed = await parseEml(raw);
    expect(parsed.body).toBe("<p>HTML body</p>");
    expect(parsed.bodyContentType).toBe("html");
  });

  it("parses cc and reply-to address fields", async () => {
    const raw = [
      "From: HR <hr@example.com>",
      "To: You <you@example.com>",
      "Cc: Manager <manager@example.com>",
      "Reply-To: Support <support@example.com>",
      "Subject: Notice",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Hello",
    ].join("\n");

    const parsed = await parseEml(raw);
    expect(parsed.cc).toBe("Manager <manager@example.com>");
    expect(parsed.replyTo).toBe("Support <support@example.com>");

    expect(listParsedEmlAddressFields(parsed)).toEqual([
      { label: "From", value: "HR <hr@example.com>" },
      { label: "To", value: "You <you@example.com>" },
      { label: "Cc", value: "Manager <manager@example.com>" },
      { label: "Reply-To", value: "Support <support@example.com>" },
    ]);
  });
});
