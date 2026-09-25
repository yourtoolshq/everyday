import { Download, Paperclip } from "lucide-react";

import type { ParsedEml } from "@yourtoolshq/data/files";
import { listParsedEmlAddressFields } from "@yourtoolshq/data/files";
import { Button } from "@yourtoolshq/ui/button";

import { formatBytes } from "./format";
import { LocalTime } from "./local-time";

export function EmlViewer({
  email,
  filename,
  downloadUrl,
}: {
  email: ParsedEml;
  filename: string;
  downloadUrl: string;
}) {
  const fields = listParsedEmlAddressFields(email);
  return (
    <main className="mx-auto flex h-dvh max-w-4xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="min-w-0 text-xl font-semibold break-words">
          {email.subject ?? filename}
        </h1>
        <Button variant="outline" size="sm" asChild>
          <a href={downloadUrl}>
            <Download />
            Download
          </a>
        </Button>
      </header>

      <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <dl className="grid min-w-0 flex-1 [grid-template-columns:auto_minmax(0,1fr)] gap-1">
          {fields.map((field) => (
            <div key={field.label} className="contents">
              <dt className="text-muted-foreground pr-3">{field.label}</dt>
              <dd className="min-w-0 break-words">{field.value}</dd>
            </div>
          ))}
        </dl>
        {email.date ? (
          <span className="text-muted-foreground shrink-0 sm:text-right">
            {Number.isNaN(Date.parse(email.date)) ? (
              email.date
            ) : (
              <LocalTime iso={email.date} />
            )}
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-white text-sm text-black">
        {email.bodyContentType === "html" ? (
          <iframe
            title="Email content"
            sandbox=""
            className="h-full w-full border-0"
            srcDoc={email.body}
          />
        ) : (
          <pre className="h-full overflow-y-auto p-4 font-sans whitespace-pre-wrap">
            {email.body}
          </pre>
        )}
      </div>

      {email.attachments.length > 0 ? (
        <section className="space-y-2 text-sm">
          <h2 className="font-medium">Attachments</h2>
          <ul className="space-y-1">
            {email.attachments.map((attachment, index) => (
              <li key={index} className="flex items-center gap-2">
                <Paperclip
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden
                />
                <span className="min-w-0 truncate">
                  {attachment.filename ?? "Unnamed attachment"}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {formatBytes(attachment.sizeBytes)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            Download the email to open its attachments.
          </p>
        </section>
      ) : null}
    </main>
  );
}
