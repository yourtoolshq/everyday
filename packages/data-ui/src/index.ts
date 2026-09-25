import type { FileRouter, StagedUpload } from "@yourtoolshq/data/files";

export { BackupStatusBanner } from "./backup-status-banner";
export { DataSettingsPage } from "./data-settings-page";

export type UploadedFile = StagedUpload;

export function createUploadHelpers<TRouter extends FileRouter>() {
  async function uploadFile(
    endpoint: keyof TRouter & string,
    file: File,
  ): Promise<UploadedFile> {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(
      `/api/data/upload/${encodeURIComponent(endpoint)}`,
      { method: "POST", body: form },
    );
    const data = (await response.json().catch(() => ({}))) as
      UploadedFile | { error?: string };
    if (!response.ok) {
      const message = "error" in data ? data.error : undefined;
      throw new Error(message ?? "The file could not be uploaded.");
    }
    return data as UploadedFile;
  }

  return { uploadFile };
}

export function fileUrl(fileId: string, options?: { download?: boolean }) {
  const path = `/api/data/files/${encodeURIComponent(fileId)}`;
  return options?.download ? `${path}?download=1` : path;
}
