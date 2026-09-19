"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { useDeleteDocumentDialog } from "~/components/documents/delete-document-dialog";
import { DocumentActionButtons } from "~/components/documents/document-action-buttons";
import { DocumentEditSheet } from "~/components/documents/document-edit-sheet";
import { EmlPreviewDialog } from "~/components/documents/eml-preview-dialog";
import { EmploymentDocumentUploadSheet } from "~/components/documents/employment-document-upload-sheet";
import {
  documentTypeLabels,
  formatDateLabel,
  formatFileSize,
  isEmlMimeType,
} from "~/lib/documents";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api, type RouterOutputs } from "~/trpc/react";

type Document = RouterOutputs["documents"]["listByEmployment"][number];

function sortDocuments(documents: Document[]) {
  return [...documents].sort((left, right) => {
    const leftDate = left.documentDate ?? left.createdAt;
    const rightDate = right.documentDate ?? right.createdAt;
    return rightDate.localeCompare(leftDate);
  });
}

export function EmploymentDocumentsPanel({ employmentId }: { employmentId: string }) {
  const documents = api.documents.listByEmployment.useQuery({ employmentId });
  const { requestDelete, dialog: deleteDialog } = useDeleteDocumentDialog();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [emlPreview, setEmlPreview] = useState<{ id: string; title: string } | null>(null);

  const employmentDocuments = useMemo(
    () => sortDocuments(documents.data ?? []),
    [documents.data],
  );

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <CardTitle className="text-base">Documents</CardTitle>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Plus />
          Add
        </Button>
      </CardHeader>
      <CardContent>
        {employmentDocuments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No documents yet. Add contracts, offer letters, or exported emails.
          </p>
        ) : (
          <ul className="divide-y">
            {employmentDocuments.map((document) => (
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
                  {document.discussionTitle ? (
                    <p className="text-xs text-muted-foreground">
                      Discussion: {document.discussionTitle}
                    </p>
                  ) : null}
                </div>
                <DocumentActionButtons
                  documentId={document.id}
                  title={document.title}
                  onPreview={
                    isEmlMimeType(document.mimeType)
                      ? () => setEmlPreview({ id: document.id, title: document.title })
                      : undefined
                  }
                  onEdit={() => setEditingDocument(document)}
                  onDelete={() => requestDelete({ id: document.id, title: document.title })}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {uploadOpen ? (
        <EmploymentDocumentUploadSheet
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          employmentId={employmentId}
        />
      ) : null}

      {editingDocument ? (
        <DocumentEditSheet
          key={editingDocument.id}
          document={editingDocument}
          employmentId={employmentId}
          open={Boolean(editingDocument)}
          onOpenChange={(open) => {
            if (!open) setEditingDocument(null);
          }}
        />
      ) : null}

      {emlPreview ? (
        <EmlPreviewDialog
          documentId={emlPreview.id}
          title={emlPreview.title}
          open={Boolean(emlPreview)}
          onOpenChange={(open) => {
            if (!open) setEmlPreview(null);
          }}
        />
      ) : null}

      {deleteDialog}
    </Card>
  );
}
