import type { ComponentProps } from "react";

export const emlMimeType = "message/rfc822";

export interface PreviewableFile {
  id: string;
  mimeType: string;
}

export function fileUrl(fileId: string, options?: { download?: boolean }) {
  const path = `/api/data/files/${encodeURIComponent(fileId)}`;
  return options?.download ? `${path}?download=1` : path;
}

export function filePreviewUrl(file: PreviewableFile) {
  if (file.mimeType === emlMimeType) {
    return `/files/${encodeURIComponent(file.id)}`;
  }
  const opensInBrowser = ["application/pdf", "image/", "audio/"].some((type) =>
    file.mimeType.startsWith(type),
  );
  return fileUrl(file.id, { download: !opensInBrowser });
}

export function FilePreview({
  file,
  ...props
}: { file: PreviewableFile } & Omit<
  ComponentProps<"a">,
  "href" | "target" | "rel"
>) {
  return (
    <a
      href={filePreviewUrl(file)}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  );
}
