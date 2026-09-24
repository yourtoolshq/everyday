"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { RouterOutputs } from "~/trpc/react";
import { EmlPreviewDialog } from "~/components/activity/eml-preview-dialog";
import { useDeleteDocumentDialog } from "~/components/documents/delete-document-dialog";
import { DocumentActionButtons } from "~/components/documents/document-action-buttons";
import { DocumentEditSheet } from "~/components/documents/document-edit-sheet";
import { Badge } from "~/components/ui/badge";
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

export function DocumentsWorkspace() {
  const documents = api.documents.overview.useQuery({
    excludeStatements: true,
  });
  const accounts = api.accounts.list.useQuery();
  const { requestDelete, dialog: deleteDialog } = useDeleteDocumentDialog();
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [emlPreview, setEmlPreview] = useState<{
    id: string;
    fileId: string;
    title: string;
  } | null>(null);

  const sortedDocuments = useMemo(
    () => sortDocuments(documents.data ?? []),
    [documents.data],
  );

  const accountById = useMemo(() => {
    const map = new Map<string, RouterOutputs["accounts"]["list"][number]>();
    for (const account of accounts.data ?? []) {
      map.set(account.id, account);
    }
    return map;
  }, [accounts.data]);

  if (documents.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading documents…</p>;
  }

  if (sortedDocuments.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No documents yet. Upload records from an account page or attach files to
        activity.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground border-b text-left">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Linked to</th>
              <th className="px-4 py-3 font-medium">File</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedDocuments.map((document) => (
              <tr key={document.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-medium">{document.title}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">
                    {documentTypeLabels[document.type]}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/accounts/${document.accountId}`}
                    className="text-primary hover:underline"
                  >
                    {document.institutionName} · {document.accountName}
                  </Link>
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {formatDateLabel(document.documentDate) ?? "—"}
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  <div className="space-y-1">
                    {document.linkedActivity ? (
                      <Link
                        href={`/activity/${document.linkedActivity.id}`}
                        className="text-primary block hover:underline"
                      >
                        Activity: {document.linkedActivity.title}
                      </Link>
                    ) : null}
                    {document.linkedTermsSnapshot ? (
                      <p>
                        Terms:{" "}
                        {formatDateLabel(
                          document.linkedTermsSnapshot.effectiveDate,
                        ) ?? document.linkedTermsSnapshot.effectiveDate}
                      </p>
                    ) : null}
                    {!document.linkedActivity && !document.linkedTermsSnapshot
                      ? "—"
                      : null}
                  </div>
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {document.originalFilename}
                  <span className="text-xs">
                    {" "}
                    · {formatFileSize(document.sizeBytes)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
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
                        requestDelete({
                          id: document.id,
                          title: document.title,
                        })
                      }
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingDocument ? (
        <DocumentEditSheet
          key={editingDocument.id}
          document={editingDocument}
          account={accountById.get(editingDocument.accountId)}
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
    </>
  );
}
