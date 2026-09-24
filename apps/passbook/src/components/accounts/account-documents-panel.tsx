"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";

import { fileUrl } from "@yourtoolshq/data-ui";

import type { RouterOutputs } from "~/trpc/react";
import { EmlPreviewDialog } from "~/components/activity/eml-preview-dialog";
import { AccountDocumentUploadSheet } from "~/components/documents/account-document-upload-sheet";
import { useDeleteDocumentDialog } from "~/components/documents/delete-document-dialog";
import { DocumentActionButtons } from "~/components/documents/document-action-buttons";
import { DocumentEditSheet } from "~/components/documents/document-edit-sheet";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  documentTypeLabels,
  formatFileSize,
  isEmlMimeType,
} from "~/lib/documents";
import { formatDateLabel } from "~/lib/format-date";
import { api } from "~/trpc/react";

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
  defaultUploadType?:
    "closure_document" | "void_cheque" | "card_letter" | "other";
  initialUploadOpen?: boolean;
  onUploadOpenChange?: (open: boolean) => void;
}) {
  const documents = api.documents.overview.useQuery({
    accountId,
    excludeStatements: true,
    excludeVoidCheques: true,
  });
  const { requestDelete, dialog: deleteDialog } = useDeleteDocumentDialog();
  const [uploadOpen, setUploadOpen] = useState(initialUploadOpen);

  function setUploadOpenState(open: boolean) {
    setUploadOpen(open);
    onUploadOpenChange?.(open);
  }
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [emlPreview, setEmlPreview] = useState<{
    id: string;
    fileId: string;
    title: string;
  } | null>(null);

  const accountDocuments = useMemo(
    () => sortDocuments(documents.data ?? []),
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
          <p className="text-muted-foreground text-sm">
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
                    <Badge variant="secondary">
                      {documentTypeLabels[document.type]}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formatDateLabel(document.documentDate) ?? "No date"}
                    {" · "}
                    {formatFileSize(document.sizeBytes)}
                  </p>
                  {document.linkedActivity ? (
                    <Link
                      href={`/activity/${document.linkedActivity.id}`}
                      className="text-primary text-xs hover:underline"
                    >
                      Activity: {document.linkedActivity.title}
                    </Link>
                  ) : null}
                </div>
                <DocumentActionButtons
                  fileId={document.fileId}
                  title={document.title}
                  mimeType={document.mimeType}
                  onPreview={
                    isEmlMimeType(document.mimeType)
                      ? () =>
                          setEmlPreview({
                            id: document.id,
                            fileId: document.fileId,
                            title: document.title,
                          })
                      : undefined
                  }
                  onEdit={() => setEditingDocument(document)}
                  onDelete={() =>
                    requestDelete({ id: document.id, title: document.title })
                  }
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
      {emlPreview ? (
        <EmlPreviewDialog
          documentId={emlPreview.id}
          fileId={emlPreview.fileId}
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

export function AccountVoidChequePanel({ accountId }: { accountId: string }) {
  const documents = api.documents.overview.useQuery({ accountId });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replaceAfterDelete, setReplaceAfterDelete] = useState(false);
  const { requestDelete, dialog: deleteDialog } = useDeleteDocumentDialog(
    () => {
      if (replaceAfterDelete) {
        setReplaceAfterDelete(false);
        setUploadOpen(true);
      }
    },
  );

  const voidCheque = (documents.data ?? []).find(
    (document) => document.type === "void_cheque",
  );

  if (documents.isLoading) return null;

  return (
    <>
      <Card
        className={
          voidCheque
            ? "shadow-none"
            : "border-amber-500/30 bg-amber-50/40 shadow-none"
        }
      >
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="space-y-1">
            <p className="font-medium">Void cheque</p>
            {voidCheque ? (
              <>
                <p className="text-muted-foreground text-sm">
                  {voidCheque.title}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatDateLabel(voidCheque.documentDate) ?? "No date"}
                  {" · "}
                  {formatFileSize(voidCheque.sizeBytes)}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Keep a void cheque on file for this chequing account.
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {voidCheque ? (
              <>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={fileUrl(voidCheque.fileId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink />
                    Open
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReplaceAfterDelete(true);
                    requestDelete({
                      id: voidCheque.id,
                      title: voidCheque.title,
                    });
                  }}
                >
                  Replace
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setUploadOpen(true)}>
                Upload void cheque
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {uploadOpen ? (
        <AccountDocumentUploadSheet
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          accountId={accountId}
          defaultType="void_cheque"
        />
      ) : null}
      {deleteDialog}
    </>
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
          <p className="text-muted-foreground text-sm">
            Upload the account closure letter or confirmation for this closed
            account.
          </p>
        </div>
        <Button variant="outline" onClick={onUpload}>
          Upload closure document
        </Button>
      </CardContent>
    </Card>
  );
}
