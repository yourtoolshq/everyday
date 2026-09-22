"use client";

import { ExternalLink, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { DiscussionFormSheet } from "~/components/discussions/discussion-form-sheet";
import { EmlPreviewDialog } from "~/components/documents/eml-preview-dialog";
import { EmploymentDocumentUploadSheet } from "~/components/documents/employment-document-upload-sheet";
import { formatDateLabel, isEmlMimeType } from "~/lib/documents";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { RichTextContent } from "~/components/ui/rich-text-editor";
import { api, type RouterOutputs } from "~/trpc/react";

type Discussion = RouterOutputs["discussions"]["listByEmployment"][number];
type Document = RouterOutputs["documents"]["listByEmployment"][number];

function sortDiscussions(discussions: Discussion[]) {
  return [...discussions].sort((left, right) => {
    const leftDate = left.discussionDate ?? left.createdAt;
    const rightDate = right.discussionDate ?? right.createdAt;
    return rightDate.localeCompare(leftDate);
  });
}

export function EmploymentDiscussionsPanel({ employmentId }: { employmentId: string }) {
  const utils = api.useUtils();
  const discussions = api.discussions.listByEmployment.useQuery({ employmentId });
  const documents = api.documents.listByEmployment.useQuery({ employmentId });
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingDiscussion, setEditingDiscussion] = useState<Discussion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Discussion | null>(null);
  const [uploadDiscussionId, setUploadDiscussionId] = useState<string | null>(null);
  const [emlPreview, setEmlPreview] = useState<{ id: string; title: string } | null>(null);

  const sortedDiscussions = useMemo(
    () => sortDiscussions(discussions.data ?? []),
    [discussions.data],
  );

  const documentsByDiscussion = useMemo(() => {
    const grouped = new Map<string, Document[]>();
    for (const document of documents.data ?? []) {
      if (!document.discussionId) continue;
      const current = grouped.get(document.discussionId) ?? [];
      current.push(document);
      grouped.set(document.discussionId, current);
    }
    return grouped;
  }, [documents.data]);

  const deleteDiscussion = api.discussions.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.discussions.listByEmployment.invalidate({ employmentId }),
        utils.documents.listByEmployment.invalidate({ employmentId }),
      ]);
      toast.success("Discussion removed.");
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(error.message),
  });

  function openCreateForm() {
    setFormMode("create");
    setEditingDiscussion(null);
    setFormOpen(true);
  }

  function openEditForm(discussion: Discussion) {
    setFormMode("edit");
    setEditingDiscussion(discussion);
    setFormOpen(true);
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <CardTitle className="text-base">Discussions</CardTitle>
        <Button size="sm" onClick={openCreateForm}>
          <Plus />
          Add
        </Button>
      </CardHeader>
      <CardContent>
        {sortedDiscussions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No discussions yet. Add notes about compensation conversations, meetings, or email
            threads.
          </p>
        ) : (
          <ul className="divide-y">
            {sortedDiscussions.map((discussion) => {
              const linkedDocuments = documentsByDiscussion.get(discussion.id) ?? [];
              return (
                <li key={discussion.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium">{discussion.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateLabel(discussion.discussionDate) ?? "No date"}
                        {discussion.participants ? ` · ${discussion.participants}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${discussion.title}`}
                        onClick={() => openEditForm(discussion)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${discussion.title}`}
                        onClick={() => setDeleteTarget(discussion)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>

                  <RichTextContent html={discussion.body} />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">Linked documents</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUploadDiscussionId(discussion.id)}
                      >
                        <Plus />
                        Add document
                      </Button>
                    </div>
                    {linkedDocuments.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No linked documents yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {linkedDocuments.map((document) => (
                          <li
                            key={document.id}
                            className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                          >
                            <p className="truncate text-sm">{document.title}</p>
                            <div className="flex shrink-0 gap-1">
                              {isEmlMimeType(document.mimeType) ? (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Preview ${document.title}`}
                                  onClick={() =>
                                    setEmlPreview({ id: document.id, title: document.title })
                                  }
                                >
                                  <Mail />
                                </Button>
                              ) : null}
                              <Button variant="ghost" size="icon-sm" asChild>
                                <a
                                  href={`/api/documents/${document.id}/file`}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`Open ${document.title}`}
                                >
                                  <ExternalLink />
                                </a>
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <DiscussionFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        employmentId={employmentId}
        mode={formMode}
        discussion={editingDiscussion ?? undefined}
      />

      {uploadDiscussionId ? (
        <EmploymentDocumentUploadSheet
          open={Boolean(uploadDiscussionId)}
          onOpenChange={(open) => {
            if (!open) setUploadDiscussionId(null);
          }}
          employmentId={employmentId}
          defaultDiscussionId={uploadDiscussionId}
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

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete discussion?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.title}" will be removed. Linked documents will stay, but their discussion link will be cleared.`
                : "This discussion will be removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDiscussion.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteDiscussion.isPending || !deleteTarget}
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) deleteDiscussion.mutate({ id: deleteTarget.id });
              }}
            >
              {deleteDiscussion.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
