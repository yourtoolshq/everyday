import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";

import { env } from "~/env";

const legacyAttachments = [
  {
    table: "record_attachments",
    owner: "record_id",
    prefix: "record",
    kind: 1,
  },
  {
    table: "tax_document_attachments",
    owner: "tax_document_id",
    prefix: "tax-document",
    kind: 2,
  },
  {
    table: "business_record_attachments",
    owner: "business_record_id",
    prefix: "business-record",
    kind: 3,
  },
  {
    table: "filing_attachments",
    owner: "filing_id",
    prefix: "filing",
    kind: 4,
  },
  {
    table: "assessment_attachments",
    owner: "assessment_id",
    prefix: "assessment",
    kind: 5,
  },
  {
    table: "cra_reference_document_attachments",
    owner: "cra_reference_document_id",
    prefix: "cra-reference-document",
    kind: 6,
  },
] as const;

function extension(mimeType: string) {
  switch (mimeType.toLowerCase()) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
    case "image/heif":
      return "heic";
    default:
      throw new Error(`Cannot migrate a file with MIME type ${mimeType}.`);
  }
}

function legacyStorageKey(kind: number, id: number, ext: string) {
  const suffix = `${kind.toString(16).padStart(4, "0")}${id.toString(16).padStart(8, "0")}`;
  return `00000000-0000-4000-8000-${suffix}.${ext}`;
}

/** Export the previous release's in-database attachments before platform migrations drop BLOBs. */
export async function exportLegacyAttachments(directory = env.DATA_DIR) {
  const dataDir = path.resolve(directory);
  const databasePath = path.join(dataDir, "taxbook.db");
  try {
    await access(databasePath);
  } catch {
    return;
  }

  const client = createClient({ url: `file:${databasePath}` });
  try {
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const existing = new Set(tables.rows.map((row) => String(row.name)));
    const documentsDir = path.join(dataDir, "documents");
    await mkdir(documentsDir, { recursive: true });

    for (const attachment of legacyAttachments) {
      if (!existing.has(attachment.table)) continue;
      const columns = await client.execute(
        `PRAGMA table_info(${attachment.table})`,
      );
      if (!columns.rows.some((column) => column.name === "data")) continue;

      const rows = await client.execute(
        `SELECT ${attachment.owner}, file_name, mime_type, data FROM ${attachment.table}`,
      );
      for (const row of rows.rows) {
        const id = `${attachment.prefix}-${row[attachment.owner]}`;
        const key = legacyStorageKey(
          attachment.kind,
          Number(row[attachment.owner]),
          extension(String(row.mime_type)),
        );
        const destination = path.join(documentsDir, key);
        const value = row.data;
        const bytes =
          value instanceof ArrayBuffer
            ? new Uint8Array(value)
            : Buffer.isBuffer(value)
              ? new Uint8Array(value)
              : null;
        if (!bytes) {
          throw new Error(
            `Legacy attachment ${id} has invalid binary content.`,
          );
        }
        try {
          await access(destination);
        } catch {
          await writeFile(destination, bytes, { flag: "wx" });
        }
      }
    }
  } finally {
    client.close();
  }
}
