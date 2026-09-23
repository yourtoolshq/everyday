"use client";

import { useEffect, useState } from "react";

import type { ParsedEml } from "~/lib/eml";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { listParsedEmlAddressFields } from "~/lib/eml";

function formatEmailDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function EmailAddressFields({ email }: { email: ParsedEml }) {
  const fields = listParsedEmlAddressFields(email);
  if (fields.length === 0 && !email.date) return null;

  return (
    <div className="flex shrink-0 items-start justify-between gap-4 text-sm">
      {fields.length > 0 ? (
        <dl className="grid min-w-0 flex-1 [grid-template-columns:auto_minmax(0,1fr)] gap-1">
          {fields.map((field) => (
            <div key={field.label} className="contents">
              <dt className="text-muted-foreground pr-3">{field.label}</dt>
              <dd className="min-w-0 break-words">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="flex-1" />
      )}
      {email.date ? (
        <time
          className="text-muted-foreground shrink-0 text-right"
          dateTime={email.date}
        >
          {formatEmailDate(email.date)}
        </time>
      ) : null}
    </div>
  );
}

export function EmlPreviewDialog({
  documentId,
  title,
  open,
  onOpenChange,
}: {
  documentId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [parsed, setParsed] = useState<ParsedEml | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setParsed(null);

    void fetch(`/api/documents/${documentId}/eml`)
      .then(async (response) => {
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? "Unable to load email preview.");
        }
        return response.json() as Promise<ParsedEml>;
      })
      .then((data) => {
        if (!cancelled) setParsed(data);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Unable to load email preview.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [documentId, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90vh,800px)] max-h-[min(90vh,800px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className="leading-snug">
            {parsed?.subject ?? title}
          </DialogTitle>
          <DialogDescription>Email preview</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 pt-3">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="min-h-0 flex-1" />
            </div>
          ) : error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : parsed ? (
            <>
              <EmailAddressFields email={parsed} />
              <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-white text-sm">
                {parsed.bodyContentType === "html" ? (
                  <iframe
                    title="Email content"
                    sandbox=""
                    className="h-full w-full border-0 bg-white"
                    srcDoc={parsed.body}
                  />
                ) : (
                  <pre className="h-full overflow-y-auto p-4 font-sans whitespace-pre-wrap">
                    {parsed.body}
                  </pre>
                )}
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 border-t">
          <Button type="button" variant="outline" asChild>
            <a
              href={`/api/documents/${documentId}/file`}
              target="_blank"
              rel="noreferrer"
            >
              Open original
            </a>
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
