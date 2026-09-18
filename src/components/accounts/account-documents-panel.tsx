"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { DocumentActionButtons } from "~/components/documents/document-action-buttons";
import { DocumentEditSheet } from "~/components/documents/document-edit-sheet";
import { useDeleteDocumentDialog } from "~/components/documents/delete-document-dialog";
import { AccountDocumentUploadSheet } from "~/components/documents/account-document-upload-sheet";
import { documentTypeLabels, formatFileSize } from "~/lib/documents";
import { formatDateLabel } from "~/lib/format-date";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api, type RouterOutputs } from "~/trpc/react";

type Document = RouterOutputs["documents"]["overview"][number];

function sortDocuments(documents: Document[]) {
  return [...documents].sort((left, right) => {
    const leftDate = left.documentDate ?? left.createdAt;
    const rightDate = right.documentDate ?? right.createdAt;
    return rightDate.localeCompare(leftDate);
  });
}

export function AccountDocumentsPanel({
  accountId,
  defaultUploadType,
  initialUploadOpen = false,
  onUploadOpenChange,
}: {
  accountId: string;
  defaultUploadType?: "closure_document" | "other";
  initialUploadOpen?: boolean;
  onUploadOpenChange?: (open: boolean) => void;
}) {
  const documents = api.documents.overview.useQuery({ accountId });
  const { requestDelete, dialog: deleteDialog } = useDeleteDocumentDialog();
  const [uploadOpen, setUploadOpen] = useState(initialUploadOpen);

  function setUploadOpenState(open: boolean) {
    setUploadOpen(open);
    onUploadOpenChange?.(open);
  }
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);

  const accountDocuments = useMemo(
    () => sortDocuments((documents.data ?? []).filter((document) => document.type !== "statement")),
    [documents.data],
  );

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <CardTitle className="text-base">Documents</CardTitle>
        <Button size="sm" onClick={() => setUploadOpenState(true)}>
          <Plus />
          Add
        </Button>
      </CardHeader>
      <CardContent>
        {accountDocuments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No documents yet. Add agreements, notices, or other records.
          </p>
        ) : (
          <ul className="divide-y">
            {accountDocuments.map((document) => (
              <li
                key={document.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{document.title}</p>
                    <Badge variant="secondary">{documentTypeLabels[document.type]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateLabel(document.documentDate) ?? "No date"}
                    {" · "}
                    {formatFileSize(document.sizeBytes)}
                  </p>
                </div>
                <DocumentActionButtons
                  documentId={document.id}
                  title={document.title}
                  onEdit={() => setEditingDocument(document)}
                  onDelete={() => requestDelete({ id: document.id, title: document.title })}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {uploadOpen ? (
        <AccountDocumentUploadSheet
          open={uploadOpen}
          onOpenChange={setUploadOpenState}
          accountId={accountId}
          defaultType={defaultUploadType ?? "other"}
        />
      ) : null}

      {editingDocument ? (
        <DocumentEditSheet
          key={editingDocument.id}
          document={editingDocument}
          open={Boolean(editingDocument)}
          onOpenChange={(open) => {
            if (!open) setEditingDocument(null);
          }}
        />
      ) : null}
      {deleteDialog}
    </Card>
  );
}

export function ClosureDocumentPrompt({
  accountId,
  onUpload,
}: {
  accountId: string;
  onUpload: () => void;
}) {
  const documents = api.documents.overview.useQuery({ accountId });
  const hasClosureDocument = (documents.data ?? []).some(
    (document) => document.type === "closure_document",
  );

  if (documents.isLoading || hasClosureDocument) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-50/40 shadow-none">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="space-y-1">
          <p className="font-medium">Closure document missing</p>
          <p className="text-sm text-muted-foreground">
            Upload the account closure letter or confirmation for this closed account.
          </p>
        </div>
        <Button variant="outline" onClick={onUpload}>
          Upload closure document
        </Button>
      </CardContent>
    </Card>
  );
}
