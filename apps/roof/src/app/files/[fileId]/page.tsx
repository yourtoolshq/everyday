import { FileViewerPage } from "@yourtoolshq/data-ui/server";

import { dataPlatform } from "~/server/data";

export default async function FilePage({
  params,
}: {
  params: Promise<{ fileId: string }>;
}) {
  const { fileId } = await params;
  return <FileViewerPage platform={dataPlatform} fileId={fileId} />;
}
