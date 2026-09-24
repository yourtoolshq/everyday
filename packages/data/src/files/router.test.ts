import { describe, expect, it } from "vitest";

import {
  createFileRouter,
  createFileTokenValue,
  describeAllowedTypes,
  file,
  fileToken,
  formatByteLimit,
  parseFileToken,
} from "./router";

const id = "4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d";

describe("file", () => {
  it.each([
    [1234, 1234],
    ["512KB", 512 * 1024],
    ["25MB", 25 * 1024 * 1024],
  ] as const)("parses %s", (maxBytes, expected) => {
    expect(file({ types: ["pdf"], maxBytes }).maxBytes).toBe(expected);
  });
});

describe("createFileRouter", () => {
  it("rejects endpoint names that cannot appear in a token", () => {
    const route = file({ types: ["pdf"], maxBytes: "1MB" });
    expect(() => createFileRouter({ "bad-name": route })).toThrow(
      "Invalid file endpoint name: bad-name",
    );
    expect(createFileRouter({ statement: route })).toEqual({
      statement: route,
    });
  });
});

describe("file tokens", () => {
  it("round-trips a token", () => {
    const token = createFileTokenValue("statement", id);
    expect(parseFileToken(token)).toEqual({ endpoint: "statement", id });
  });

  it.each([
    "statement",
    `statement:${id}:extra`,
    `statement:../${id}`,
    `statement:${id.toUpperCase()}`,
    `:${id}`,
  ])("rejects malformed token %s", (token) => {
    expect(parseFileToken(token)).toBeNull();
  });

  it("validates the endpoint in the zod schema", () => {
    const schema = fileToken("statement");
    expect(schema.safeParse(`statement:${id}`).success).toBe(true);
    const wrongEndpoint = schema.safeParse(`voiceNote:${id}`);
    expect(wrongEndpoint.success).toBe(false);
    expect(wrongEndpoint.error?.issues[0]?.message).toBe(
      "Upload the file again.",
    );
  });
});

describe("messages", () => {
  it("lists allowed types", () => {
    expect(describeAllowedTypes(["pdf"])).toBe("Upload a PDF.");
    expect(describeAllowedTypes(["pdf", "image", "eml"])).toBe(
      "Upload a PDF, an image, or an .eml file.",
    );
  });

  it("formats byte limits", () => {
    expect(formatByteLimit(25 * 1024 * 1024)).toBe("25 MB");
    expect(formatByteLimit(512 * 1024)).toBe("512 KB");
  });
});
