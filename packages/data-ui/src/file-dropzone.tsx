"use client";

import { useRef, useState } from "react";
import { CircleAlert, CircleCheck, FileUp, LoaderCircle } from "lucide-react";

import { Button } from "@yourtoolshq/ui/button";
import { Progress } from "@yourtoolshq/ui/progress";

import type { Upload } from "./upload";
import { formatBytes } from "./format";

export function FileDropzone({
  upload,
  id,
  accept,
}: {
  upload: Upload;
  // Lets a <label htmlFor> name the file input.
  id?: string;
  accept?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function start(file: File | undefined) {
    if (file) void upload.upload(file);
  }
  const choose = () => input.current?.click();

  return (
    <div
      data-dragging={dragging ? "" : undefined}
      className="data-dragging:border-primary data-dragging:bg-muted/50 rounded-lg border border-dashed p-4 text-sm transition-colors"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        start(event.dataTransfer.files[0]);
      }}
    >
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          start(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {upload.status === "idle" ? (
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <FileUp className="text-muted-foreground size-6" aria-hidden />
          <p className="text-muted-foreground">Drop a file here, or</p>
          <Button type="button" variant="outline" size="sm" onClick={choose}>
            Choose a file
          </Button>
        </div>
      ) : (
        <UploadProgress upload={upload} onReplace={choose} />
      )}
    </div>
  );
}

export function UploadProgress({
  upload,
  onReplace,
}: {
  upload: Upload;
  onReplace: () => void;
}) {
  const percent = Math.round(upload.progress * 100);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 [&>svg]:size-4 [&>svg]:shrink-0">
        {upload.status === "uploading" ? (
          <LoaderCircle
            className="text-muted-foreground animate-spin"
            aria-hidden
          />
        ) : upload.status === "uploaded" ? (
          <CircleCheck className="text-muted-foreground" aria-hidden />
        ) : (
          <CircleAlert className="text-destructive" aria-hidden />
        )}
        <div className="min-w-0 flex-1 basis-32">
          <p className="truncate font-medium">{upload.source?.name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {upload.status === "uploading"
              ? `Uploading… ${percent}%`
              : upload.status === "uploaded" && upload.file
                ? `${formatBytes(upload.file.size)} · Uploaded`
                : "Not uploaded"}
          </p>
        </div>
        <div className="ml-auto flex">
          <Button type="button" variant="ghost" size="sm" onClick={onReplace}>
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={upload.reset}
          >
            Remove
          </Button>
        </div>
      </div>
      {upload.status === "uploading" ? (
        <Progress value={percent} aria-label="Upload progress" />
      ) : null}
      {upload.status === "failed" ? (
        <p role="alert" className="text-destructive text-xs">
          {upload.error}
        </p>
      ) : null}
    </div>
  );
}
