import type { FileRouter } from "@yourtoolshq/data/files";

import type { Upload } from "./upload";
import { FileDropzone } from "./file-dropzone";
import { useUpload } from "./upload";

export { BackupStatusBanner } from "./backup-status-banner";
export { DataSettingsPage } from "./data-settings-page";
export type { Upload, UploadedFile, UploadState } from "./upload";

export function createUploadHelpers<TRouter extends FileRouter>() {
  const useTypedUpload: (endpoint: keyof TRouter & string) => Upload =
    useUpload;
  return { FileDropzone, useUpload: useTypedUpload };
}

export function fileUrl(fileId: string, options?: { download?: boolean }) {
  const path = `/api/data/files/${encodeURIComponent(fileId)}`;
  return options?.download ? `${path}?download=1` : path;
}
