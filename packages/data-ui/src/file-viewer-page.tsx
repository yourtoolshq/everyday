import { notFound, redirect } from "next/navigation";

import type { DataPlatform } from "@yourtoolshq/data";
import { parseEml } from "@yourtoolshq/data/files";

import { DataGate } from "./data-gate";
import { EmlViewer } from "./eml-viewer";
import { emlMimeType, fileUrl } from "./file-preview";

type StoredFiles = Pick<DataPlatform["files"], "read">;

export function FileViewerPage({
  platform,
  fileId,
}: {
  platform: Pick<DataPlatform, "status"> & { files: StoredFiles };
  fileId: string;
}) {
  return (
    <DataGate platform={platform}>
      <StoredFileViewer files={platform.files} fileId={fileId} />
    </DataGate>
  );
}

export async function StoredFileViewer({
  files,
  fileId,
}: {
  files: StoredFiles;
  fileId: string;
}) {
  const stored = await files.read(fileId);
  if (!stored) notFound();
  if (stored.file.mimeType !== emlMimeType) redirect(fileUrl(fileId));
  return (
    <EmlViewer
      email={await parseEml(stored.bytes)}
      filename={stored.file.originalFilename}
      downloadUrl={fileUrl(fileId, { download: true })}
    />
  );
}
