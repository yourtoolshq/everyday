"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { DocumentActionButtons } from "~/components/documents/document-action-buttons";
import { useDeleteDocumentDialog } from "~/components/documents/delete-document-dialog";
import { DocumentEditSheet } from "~/components/documents/document-edit-sheet";
import { documentTypeLabels, formatFileSize } from "~/lib/documents";
import { formatDateLabel } from "~/lib/format-date";
import { formatPeriodKey } from "~/lib/expected-periods";
import { Badge } from "~/components/ui/badge";
import { api, type RouterOutputs } from "~/trpc/react";

type Document = RouterOutputs["documents"]["overview"][number];

function sortDocuments(documents: Document[]) {
  return [...documents].sort((left, right) => {
    const leftDate = left.documentDate ?? left.createdAt;
    const rightDate = right.documentDate ?? right.createdAt;
    return rightDate.localeCompare(leftDate);
  });
}

export function DocumentsWorkspace() {
  const documents = api.documents.overview.useQuery();
  const accounts = api.accounts.list.useQuery();
  const { requestDelete, dialog: deleteDialog } = useDeleteDocumentDialog();
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);

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
    return <p className="text-sm text-muted-foreground">Loading documents…</p>;
  }

  if (sortedDocuments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No documents yet. Upload statements or account records from an account page.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">File</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedDocuments.map((document) => (
              <tr key={document.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-medium">{document.title}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{documentTypeLabels[document.type]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/accounts/${document.accountId}`}
                    className="text-primary hover:underline"
                  >
                    {document.institutionName} · {document.accountName}
                  </Link>
                  {document.periodKey ? (
                    <p className="text-xs text-muted-foreground">
                      {formatPeriodKey(document.periodKey)}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDateLabel(document.documentDate) ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {document.originalFilename}
                  <span className="text-xs"> · {formatFileSize(document.sizeBytes)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <DocumentActionButtons
                      documentId={document.id}
                      title={document.title}
                      onEdit={() => setEditingDocument(document)}
                      onDelete={() => requestDelete({ id: document.id, title: document.title })}
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
      {deleteDialog}
    </>
  );
}
