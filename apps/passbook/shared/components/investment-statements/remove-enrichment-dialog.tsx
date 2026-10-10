"use client";

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
} from "@yourtoolshq/ui/alert-dialog";

import { invalidateInvestmentCaches } from "~/components/investment-statements/investment-invalidation";
import { api } from "~/trpc/react";

export function RemoveEnrichmentDialog({
  open,
  onOpenChange,
  documentId,
  accountId,
  expectedRevision,
  onRemoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  accountId: string;
  expectedRevision: number;
  onRemoved: () => void;
}) {
  const utils = api.useUtils();
  const remove = api.investmentStatements.remove.useMutation({
    onSuccess: async () => {
      await invalidateInvestmentCaches(utils, { documentId, accountId });
      toast.success(
        "Investment details removed. The statement file is unchanged.",
      );
      onOpenChange(false);
      onRemoved();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove investment details?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes entered summary and holdings for this statement. The
            uploaded file and period coverage stay as they are.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ documentId, expectedRevision })}
          >
            Remove details
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
