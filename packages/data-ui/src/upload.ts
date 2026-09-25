"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { StagedUpload } from "@yourtoolshq/data/files";

import { describeError } from "./client";

export type UploadedFile = StagedUpload;

export interface UploadState {
  status: "idle" | "uploading" | "uploaded" | "failed";
  // The file the user picked, from the moment the upload starts.
  source: File | null;
  // 0 to 1 while uploading.
  progress: number;
  file: UploadedFile | null;
  error: string | null;
}

export interface Upload extends UploadState {
  // Resolves to null when the upload fails or is replaced; the reason is in `error`.
  upload: (file: File) => Promise<UploadedFile | null>;
  reset: () => void;
}

const idle: UploadState = {
  status: "idle",
  source: null,
  progress: 0,
  file: null,
  error: null,
};

export function uploadFile(
  endpoint: string,
  file: File,
  options: {
    onProgress?: (progress: number) => void;
    signal?: AbortSignal;
  } = {},
) {
  return new Promise<UploadedFile>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/data/upload/${encodeURIComponent(endpoint)}`);
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        options.onProgress?.(event.loaded / event.total);
    };
    request.onload = () => {
      const data = request.response as UploadedFile | { error?: string } | null;
      if (request.status >= 200 && request.status < 300 && data) {
        resolve(data as UploadedFile);
        return;
      }
      const message = data && "error" in data ? data.error : undefined;
      reject(new Error(message ?? "The file could not be uploaded."));
    };
    request.onerror = () =>
      reject(
        new Error("The file could not be uploaded. Check the connection."),
      );
    request.onabort = () =>
      reject(new DOMException("The upload was cancelled.", "AbortError"));
    options.signal?.addEventListener("abort", () => request.abort(), {
      once: true,
    });
    const form = new FormData();
    form.append("file", file);
    request.send(form);
  });
}

export function useUpload(endpoint: string): Upload {
  const [state, setState] = useState(idle);
  const current = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    current.current?.abort();
    current.current = null;
    setState(idle);
  }, []);

  const upload = useCallback(
    async (source: File) => {
      current.current?.abort();
      const controller = new AbortController();
      current.current = controller;
      const uploading = { ...idle, status: "uploading" as const, source };
      setState(uploading);
      try {
        const file = await uploadFile(endpoint, source, {
          signal: controller.signal,
          onProgress: (progress) => {
            if (!controller.signal.aborted) {
              setState({ ...uploading, progress });
            }
          },
        });
        if (controller.signal.aborted) return null;
        setState({ ...idle, status: "uploaded", source, progress: 1, file });
        return file;
      } catch (error) {
        if (controller.signal.aborted) return null;
        setState({
          ...idle,
          status: "failed",
          source,
          error: describeError(error),
        });
        return null;
      }
    },
    [endpoint],
  );

  useEffect(() => () => current.current?.abort(), []);

  return { ...state, upload, reset };
}
