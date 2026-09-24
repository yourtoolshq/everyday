export type FileTypeGroup = "pdf" | "image" | "eml" | "audio";

export interface DetectedFileType {
  group: FileTypeGroup;
  mimeType: string;
  extension: string;
}

const heicBrands = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis"]);

const signatures: {
  type: DetectedFileType;
  match: (bytes: Uint8Array) => boolean;
}[] = [
  {
    type: { group: "pdf", mimeType: "application/pdf", extension: "pdf" },
    match: (bytes) => ascii(bytes, 0, 5) === "%PDF-",
  },
  {
    type: { group: "image", mimeType: "image/jpeg", extension: "jpg" },
    match: (bytes) =>
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff,
  },
  {
    type: { group: "image", mimeType: "image/png", extension: "png" },
    match: (bytes) =>
      bytes.length >= 8 &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
        (byte, index) => bytes[index] === byte,
      ),
  },
  {
    type: { group: "image", mimeType: "image/webp", extension: "webp" },
    match: (bytes) =>
      ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP",
  },
  {
    type: { group: "image", mimeType: "image/heic", extension: "heic" },
    match: (bytes) => ascii(bytes, 4, 8) === "ftyp" && hasHeicBrand(bytes),
  },
];

const audioSignatures: typeof signatures = [
  {
    type: { group: "audio", mimeType: "audio/mpeg", extension: "mp3" },
    match: (bytes) => ascii(bytes, 0, 3) === "ID3",
  },
  {
    type: { group: "audio", mimeType: "audio/mp4", extension: "m4a" },
    match: (bytes) =>
      ascii(bytes, 4, 8) === "ftyp" &&
      ["M4A ", "mp42"].includes(ascii(bytes, 8, 12)),
  },
  {
    type: { group: "audio", mimeType: "audio/wav", extension: "wav" },
    match: (bytes) =>
      ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WAVE",
  },
  {
    type: { group: "audio", mimeType: "audio/ogg", extension: "ogg" },
    match: (bytes) => ascii(bytes, 0, 4) === "OggS",
  },
];

const eml: DetectedFileType = {
  group: "eml",
  mimeType: "message/rfc822",
  extension: "eml",
};

// Formats without a reliable magic number are accepted by filename extension.
const byExtension: Record<string, DetectedFileType> = {
  eml,
  ...Object.fromEntries(
    audioSignatures.map(({ type }) => [type.extension, type]),
  ),
};

export function detectFileType(
  bytes: Uint8Array,
  filename?: string,
): DetectedFileType | null {
  const signature = signatures.find(({ match }) => match(bytes));
  if (signature) return signature.type;
  if (looksLikeEml(bytes, filename)) return eml;
  const audio = audioSignatures.find(({ match }) => match(bytes));
  if (audio) return audio.type;
  const extension = filename?.split(".").pop()?.toLowerCase();
  return extension ? (byExtension[extension] ?? null) : null;
}

function looksLikeEml(bytes: Uint8Array, filename?: string) {
  if (filename?.toLowerCase().endsWith(".eml")) return true;
  const sample = new TextDecoder("utf-8", { fatal: false }).decode(
    bytes.subarray(0, 4096),
  );
  return /^(from|received|return-path|message-id|date|subject|mime-version):/im.test(
    sample,
  );
}

function hasHeicBrand(bytes: Uint8Array) {
  if (heicBrands.has(ascii(bytes, 8, 12))) return true;
  for (let offset = 16; offset + 4 <= Math.min(bytes.length, 64); offset += 4) {
    if (heicBrands.has(ascii(bytes, offset, offset + 4))) return true;
  }
  return false;
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  if (bytes.length < end) return "";
  return String.fromCharCode(...bytes.subarray(start, end));
}
