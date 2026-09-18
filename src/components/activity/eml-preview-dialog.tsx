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
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "Unable to load email preview.");
        }
        return response.json() as Promise<ParsedEml>;
      })
      .then((data) => {
        if (!cancelled) setParsed(data);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Unable to load email preview.");
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
      <DialogContent className="flex max-h-[min(90vh,800px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-4 py-4">
          <DialogTitle>{parsed?.subject ?? title}</DialogTitle>
          <DialogDescription>Email preview</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : parsed ? (
            <>
              <dl className="space-y-2 text-sm">
                {parsed.from ? (
                  <div>
                    <dt className="font-medium text-muted-foreground">From</dt>
                    <dd>{parsed.from}</dd>
                  </div>
                ) : null}
                {parsed.to ? (
                  <div>
                    <dt className="font-medium text-muted-foreground">To</dt>
                    <dd>{parsed.to}</dd>
                  </div>
                ) : null}
                {parsed.date ? (
                  <div>
                    <dt className="font-medium text-muted-foreground">Date</dt>
                    <dd>{parsed.date}</dd>
                  </div>
                ) : null}
                {parsed.subject ? (
                  <div>
                    <dt className="font-medium text-muted-foreground">Subject</dt>
                    <dd>{parsed.subject}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="overflow-hidden rounded-lg border bg-white text-sm">
                {parsed.bodyContentType === "html" ? (
                  <iframe
                    title="Email content"
                    sandbox=""
                    className="h-[min(60vh,560px)] w-full border-0 bg-white"
                    srcDoc={parsed.body}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap p-4 font-sans">{parsed.body}</pre>
                )}
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter className="border-t">
          <Button type="button" variant="outline" asChild>
            <a href={`/api/documents/${documentId}/file`} target="_blank" rel="noreferrer">
              Open original
            </a>
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
