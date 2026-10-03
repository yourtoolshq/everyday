import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { EmlViewer } from "@yourtoolshq/data-ui/eml-viewer";
import { emlMimeType } from "@yourtoolshq/data-ui/file-preview";
import { parseEml } from "@yourtoolshq/data/files";
import { Button } from "@yourtoolshq/ui/button";

import { hostApiPath } from "../lib/host";

export function FileViewerRoute() {
  const { fileId } = useParams();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | {
        kind: "eml";
        email: Awaited<ReturnType<typeof parseEml>>;
        filename: string;
        downloadUrl: string;
      }
  >({ kind: "loading" });

  useEffect(() => {
    if (!fileId) {
      setState({ kind: "error", message: "File not found." });
      return;
    }

    void (async () => {
      const response = await fetch(hostApiPath(`/api/data/files/${fileId}`));
      if (!response.ok) {
        setState({ kind: "error", message: "File not found." });
        return;
      }

      const mimeType = response.headers.get("content-type") ?? "";
      if (!mimeType.startsWith(emlMimeType)) {
        window.location.replace(hostApiPath(`/api/data/files/${fileId}`));
        return;
      }

      const parsed = await parseEml(
        new Uint8Array(await response.arrayBuffer()),
      );
      setState({
        kind: "eml",
        email: parsed,
        filename: "message.eml",
        downloadUrl: hostApiPath(`/api/data/files/${fileId}?download=1`),
      });
    })();
  }, [fileId]);

  if (state.kind === "loading") return null;
  if (state.kind === "error") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-8">
        <p>{state.message}</p>
        <Button asChild variant="outline">
          <a href="/">Back to Passbook</a>
        </Button>
      </main>
    );
  }

  return (
    <EmlViewer
      email={state.email}
      filename={state.filename}
      downloadUrl={state.downloadUrl}
    />
  );
}
