import PostalMime from "postal-mime";

export interface ParsedEml {
  from: string | null;
  to: string | null;
  cc: string | null;
  bcc: string | null;
  replyTo: string | null;
  subject: string | null;
  date: string | null;
  body: string;
  bodyContentType: "text" | "html";
  attachments: EmlAttachment[];
}

export interface EmlAttachment {
  filename: string | null;
  mimeType: string;
  sizeBytes: number;
}

interface PostalAddress {
  name?: string;
  address?: string;
}

function nonEmpty(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed;
}

function formatAddress(address?: PostalAddress) {
  if (!address) return null;
  if (address.address) {
    return address.name
      ? `${address.name} <${address.address}>`
      : address.address;
  }
  return nonEmpty(address.name);
}

function formatAddresses(addresses?: PostalAddress[]) {
  if (!addresses?.length) return null;
  return (
    addresses
      .map((address) => formatAddress(address))
      .filter(Boolean)
      .join(", ") || null
  );
}

export async function parseEml(raw: string | Uint8Array): Promise<ParsedEml> {
  const input = typeof raw === "string" ? new TextEncoder().encode(raw) : raw;
  const email = await PostalMime.parse(input);

  const html = nonEmpty(email.html);
  const text = nonEmpty(email.text);

  return {
    from: formatAddress(email.from),
    to: formatAddresses(email.to),
    cc: formatAddresses(email.cc),
    bcc: formatAddresses(email.bcc),
    replyTo: formatAddresses(email.replyTo),
    subject: nonEmpty(email.subject),
    date: nonEmpty(email.date),
    body: html ?? text ?? "",
    bodyContentType: html ? "html" : "text",
    // Related parts are the images an HTML body embeds.
    attachments: email.attachments
      .filter((attachment) => !attachment.related)
      .map((attachment) => ({
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        sizeBytes:
          typeof attachment.content === "string"
            ? attachment.content.length
            : attachment.content.byteLength,
      })),
  };
}

export function listParsedEmlAddressFields(email: ParsedEml) {
  return [
    { label: "From", value: email.from },
    { label: "To", value: email.to },
    { label: "Cc", value: email.cc },
    { label: "Bcc", value: email.bcc },
    { label: "Reply-To", value: email.replyTo },
  ].filter((field): field is { label: string; value: string } =>
    Boolean(field.value),
  );
}
