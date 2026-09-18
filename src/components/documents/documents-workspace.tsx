"use client";

import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatementUploadSheet } from "~/components/documents/statement-upload-sheet";
import { documentTypeLabels, formatFileSize } from "~/lib/documents";
import { formatPeriodKey } from "~/lib/expected-periods";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { api } from "~/trpc/react";

export function DocumentsWorkspace() {
  const utils = api.useUtils();
  const documents = api.documents.overview.useQuery();
  const [uploadOpen, setUploadOpen] = useState(false);
  const deleteDocument = api.documents.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.documents.overview.invalidate(),
        utils.documents.statementDocumentsByAccount.invalidate(),
      ]);
      toast.success("Document removed.");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setUploadOpen(true)}>
          <Plus /> Upload statement
        </Button>
      </div>

      {documents.data?.map((document) => (
        <Card key={document.id} className="shadow-none">
          <CardContent className="flex items-start justify-between gap-4 p-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{document.title}</p>
                <Badge variant="secondary">{documentTypeLabels[document.type]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {document.institutionName} · {document.accountName}
                {document.periodKey ? ` · ${formatPeriodKey(document.periodKey)}` : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {document.originalFilename} · {formatFileSize(document.sizeBytes)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" asChild>
                <a
                  href={`/api/documents/${document.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${document.title}`}
                >
                  <ExternalLink />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${document.title}`}
                onClick={() => deleteDocument.mutate({ id: document.id })}
              >
                <Trash2 />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {documents.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No documents yet. Upload a statement to link a file to an account and period.
        </p>
      ) : null}

      {uploadOpen ? (
        <StatementUploadSheet open={uploadOpen} onOpenChange={setUploadOpen} />
      ) : null}
    </div>
  );
}
