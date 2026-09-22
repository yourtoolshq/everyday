import PostalMime from "postal-mime";

export type ParsedEml = {
  from: string | null;
  to: string | null;
  cc: string | null;
  bcc: string | null;
  replyTo: string | null;
  subject: string | null;
  date: string | null;
  body: string;
  bodyContentType: "text" | "html";
};

type PostalAddress = {
  name?: string;
  address?: string;
};

function formatAddress(address?: PostalAddress) {
  if (!address) return null;
  if (address.address) {
    return address.name
      ? `${address.name} <${address.address}>`
      : address.address;
  }
  return address.name || null;
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

  const html = email.html?.trim();
  const text = email.text?.trim();

  return {
    from: formatAddress(email.from),
    to: formatAddresses(email.to),
    cc: formatAddresses(email.cc),
    bcc: formatAddresses(email.bcc),
    replyTo: formatAddresses(email.replyTo),
    subject: email.subject?.trim() || null,
    date: email.date?.trim() || null,
    body: html || text || "",
    bodyContentType: html ? "html" : "text",
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
