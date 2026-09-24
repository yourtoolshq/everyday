import { describe, expect, it } from "vitest";

import { detectFileType } from "./detect";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((value) =>
      typeof value === "string"
        ? [...value].map((character) => character.charCodeAt(0))
        : [value],
    ),
  );

describe("detectFileType", () => {
  it.each([
    ["pdf", bytes("%PDF-1.7"), "application/pdf", "pdf"],
    ["jpeg", bytes(0xff, 0xd8, 0xff, 0xe0), "image/jpeg", "jpg"],
    [
      "png",
      bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
      "image/png",
      "png",
    ],
    ["webp", bytes("RIFF", 0, 0, 0, 0, "WEBP"), "image/webp", "webp"],
    ["heic", bytes(0, 0, 0, 24, "ftypheic"), "image/heic", "heic"],
    [
      "heic compatible brand",
      bytes(0, 0, 0, 24, "ftypmif1", 0, 0, 0, 0, "heic"),
      "image/heic",
      "heic",
    ],
    ["mp3", bytes("ID3", 4, 0), "audio/mpeg", "mp3"],
    ["m4a", bytes(0, 0, 0, 32, "ftypM4A "), "audio/mp4", "m4a"],
    ["wav", bytes("RIFF", 0, 0, 0, 0, "WAVE"), "audio/wav", "wav"],
    ["ogg", bytes("OggS", 0), "audio/ogg", "ogg"],
  ])("detects %s by signature", (_name, input, mimeType, extension) => {
    expect(detectFileType(input)).toMatchObject({ mimeType, extension });
  });

  it("detects eml by headers", () => {
    const email = bytes("From: sender@example.com\r\nSubject: Hello\r\n\r\n");
    expect(detectFileType(email)?.group).toBe("eml");
  });

  it("detects eml by filename", () => {
    expect(detectFileType(bytes("plain body"), "Notice.EML")?.group).toBe(
      "eml",
    );
  });

  it("prefers the signature over the filename", () => {
    expect(detectFileType(bytes("%PDF-1.4"), "statement.eml")?.group).toBe(
      "pdf",
    );
  });

  it("falls back to the extension for audio without a signature", () => {
    expect(detectFileType(bytes(0xff, 0xfb, 0x90), "memo.mp3")?.mimeType).toBe(
      "audio/mpeg",
    );
  });

  it.each([
    ["unknown bytes", bytes("hello"), "notes.txt"],
    ["no extension", bytes("hello"), "notes"],
    ["trailing dot", bytes("hello"), "notes."],
    ["empty", new Uint8Array(), undefined],
    ["pdf extension without signature", bytes("hello"), "fake.pdf"],
  ])("returns null for %s", (_name, input, filename) => {
    expect(detectFileType(input, filename)).toBeNull();
  });
});
