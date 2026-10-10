"use client";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { Button } from "@yourtoolshq/ui/button";

/** Local PDF.js rendering also works in shells without a native PDF plugin. */
export function StatementPdfPreview({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(400);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let destroy: (() => void) | undefined;
    setPdf(null);
    setPage(1);
    setError(null);
    void (async () => {
      const lib = await import("pdfjs-dist");
      // The worker is bundled locally; statement contents never leave the host.
      lib.GlobalWorkerOptions.workerSrc = workerUrl;
      if (disposed) return;
      const task = lib.getDocument({ url, withCredentials: true });
      destroy = () => {
        void task.destroy();
      };
      const document = await task.promise;
      if (!disposed) setPdf(document);
    })().catch((cause: unknown) => {
      if (!disposed)
        setError(
          cause instanceof Error ? cause.message : "Could not render this PDF.",
        );
    });
    return () => {
      disposed = true;
      destroy?.();
    };
  }, [url]);

  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(200, entry.contentRect.width));
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let disposed = false;
    let render: RenderTask | undefined;
    const target = canvas.current;
    void (async () => {
      const source = await pdf.getPage(page);
      if (disposed) return;
      const viewport = source.getViewport({
        scale: (width / source.getViewport({ scale: 1 }).width) * zoom,
      });
      const ratio = window.devicePixelRatio || 1;
      target.width = Math.floor(viewport.width * ratio);
      target.height = Math.floor(viewport.height * ratio);
      target.style.width = `${viewport.width}px`;
      target.style.height = `${viewport.height}px`;
      render = source.render({
        canvas: target,
        viewport,
        transform: [ratio, 0, 0, ratio, 0, 0],
      });
      await render.promise;
      const content = await source.getTextContent();
      if (!disposed)
        setText(
          content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" "),
        );
    })().catch((cause: unknown) => {
      if (!disposed)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not render this page.",
        );
    });
    return () => {
      disposed = true;
      render?.cancel();
    };
  }, [pdf, page, width, zoom]);

  return (
    <section
      className="flex h-full min-h-96 min-w-0 flex-col overflow-hidden rounded-lg border"
      aria-label="Source PDF"
    >
      <div className="bg-background flex flex-wrap items-center justify-between gap-1 border-b px-2 py-2">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Previous PDF page"
            disabled={!pdf || page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-muted-foreground text-xs tabular-nums">
            Page {page} / {pdf?.numPages ?? "…"}
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Next PDF page"
            disabled={!pdf || page >= pdf.numPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Zoom out PDF"
            disabled={zoom <= 0.75}
            onClick={() => setZoom(Math.max(0.75, zoom - 0.25))}
          >
            <ZoomOut />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setZoom(1)}>
            Fit
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Zoom in PDF"
            disabled={zoom >= 2}
            onClick={() => setZoom(Math.min(2, zoom + 0.25))}
          >
            <ZoomIn />
          </Button>
        </div>
      </div>
      <div
        ref={container}
        className="bg-muted/40 min-h-0 flex-1 overflow-auto p-4"
      >
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}{" "}
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Open source file
            </a>
          </p>
        ) : !pdf ? (
          <p role="status" className="text-muted-foreground text-sm">
            Loading source PDF…
          </p>
        ) : null}
        <canvas
          ref={canvas}
          role="img"
          aria-label={`${title}, page ${page}`}
          className="mx-auto bg-white shadow-sm"
        />
        <p className="sr-only">{text}</p>
      </div>
    </section>
  );
}
