"use client";

import { useState } from "react";
import { toast } from "sonner";

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
import { api } from "~/trpc/react";

type DeleteTarget = {
  id: string;
  title: string;
};

export function DeleteDocumentDialog({
  target,
  open,
  onOpenChange,
  onDeleted,
}: {
  target: DeleteTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const utils = api.useUtils();

  const deleteDocument = api.documents.delete.useMutation({
    onSuccess: async () => {
      await utils.documents.listByEmployment.invalidate();
      toast.success("Document removed.");
      onOpenChange(false);
      onDeleted?.();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete document?</AlertDialogTitle>
          <AlertDialogDescription>
            {target
              ? `"${target.title}" will be removed permanently. This cannot be undone.`
              : "This document will be removed permanently. This cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteDocument.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteDocument.isPending || !target}
            onClick={(event) => {
              event.preventDefault();
              if (target) deleteDocument.mutate({ id: target.id });
            }}
          >
            {deleteDocument.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function useDeleteDocumentDialog(onDeleted?: () => void) {
  const [target, setTarget] = useState<DeleteTarget | null>(null);

  return {
    requestDelete: (document: DeleteTarget) => setTarget(document),
    dialog: (
      <DeleteDocumentDialog
        target={target}
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        onDeleted={onDeleted}
      />
    ),
  };
}
