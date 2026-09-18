import { describe, expect, it } from "vitest";

import { listParsedEmlAddressFields, parseEml } from "~/lib/eml";

describe("parseEml", () => {
  it("parses a simple plain-text message", async () => {
    const raw = [
      "From: Bank <noreply@example.com>",
      "To: You <you@example.com>",
      "Subject: Credit limit update",
      "Date: Mon, 12 May 2025 14:22:00 -0400",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Your credit limit has been increased.",
    ].join("\n");

    const parsed = await parseEml(raw);
    expect(parsed.from).toBe("Bank <noreply@example.com>");
    expect(parsed.to).toBe("You <you@example.com>");
    expect(parsed.subject).toBe("Credit limit update");
    expect(parsed.body).toBe("Your credit limit has been increased.");
    expect(parsed.bodyContentType).toBe("text");
  });

  it("prefers html in multipart messages for preview", async () => {
    const raw = [
      "From: Bank <noreply@example.com>",
      "Subject: Notice",
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

  it("decodes mime-encoded subjects", async () => {
    const raw = [
      "From: Jomo <support@jomo.so>",
      "To: you@example.com",
      "Subject: =?UTF-8?Q?Tell_us_about_your_experience_with_Jomo_?= =?UTF-8?Q?=F0=9F=94=8D?=",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Hello",
    ].join("\n");

    const parsed = await parseEml(raw);
    expect(parsed.subject).toBe("Tell us about your experience with Jomo 🔍");
  });

  it("parses cc and reply-to address fields", async () => {
    const raw = [
      "From: Bank <noreply@example.com>",
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
    expect(parsed.bcc).toBeNull();

    expect(listParsedEmlAddressFields(parsed)).toEqual([
      { label: "From", value: "Bank <noreply@example.com>" },
      { label: "To", value: "You <you@example.com>" },
      { label: "Cc", value: "Manager <manager@example.com>" },
      { label: "Reply-To", value: "Support <support@example.com>" },
    ]);
  });
});
