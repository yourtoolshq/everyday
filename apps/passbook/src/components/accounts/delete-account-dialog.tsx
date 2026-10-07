"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Input } from "@yourtoolshq/ui/input";
import { Label } from "@yourtoolshq/ui/label";

import { api } from "~/trpc/react";

function DeleteImpactSummary({
  documentCount,
  activityCount,
  termsSnapshotCount,
}: {
  documentCount: number;
  activityCount: number;
  termsSnapshotCount: number;
}) {
  const items: string[] = [];
  if (documentCount > 0) {
    items.push(
      `${documentCount} document${documentCount === 1 ? "" : "s"} (statements, uploads, and other files)`,
    );
  }
  if (activityCount > 0) {
    items.push(
      `${activityCount} activity ${activityCount === 1 ? "entry" : "entries"}`,
    );
  }
  if (termsSnapshotCount > 0) {
    items.push(
      `${termsSnapshotCount} terms ${termsSnapshotCount === 1 ? "snapshot" : "snapshots"}`,
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        This account has no uploaded documents or activity yet.
      </p>
    );
  }

  return (
    <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function DeleteAccountDialog({
  accountId,
  open,
  onOpenChange,
}: {
  accountId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [confirmName, setConfirmName] = useState("");

  const preview = api.accounts.deletePreview.useQuery(
    { id: accountId },
    { enabled: open },
  );

  useEffect(() => {
    if (!open) setConfirmName("");
  }, [open]);

  const deleteAccount = api.accounts.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.accounts.invalidate(),
        utils.documents.invalidate(),
        utils.accountEvents.invalidate(),
        utils.accountTerms.invalidate(),
        utils.statementPeriodExceptions.invalidate(),
        utils.overview.invalidate(),
      ]);
      toast.success("Account deleted.");
      onOpenChange(false);
      router.push("/accounts");
    },
    onError: (error) => toast.error(error.message),
  });

  const displayName = preview.data?.displayName ?? "";
  const documentCount = preview.data?.documentCount ?? 0;
  const requiresTypedName = documentCount > 0;
  const nameMatches =
    !requiresTypedName || confirmName.trim() === displayName.trim();

  const pending = deleteAccount.isPending;
  const canDelete = preview.isSuccess && nameMatches && !pending;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete account?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              {preview.isLoading ? (
                <p className="text-muted-foreground text-sm">
                  Loading what will be removed…
                </p>
              ) : preview.error ? (
                <p className="text-destructive text-sm">
                  {preview.error.message}
                </p>
              ) : preview.data ? (
                <>
                  <p className="text-sm">
                    <span className="text-foreground font-medium">
                      &quot;{preview.data.displayName}&quot;
                    </span>{" "}
                    will be permanently removed along with:
                  </p>
                  <DeleteImpactSummary
                    documentCount={preview.data.documentCount}
                    activityCount={preview.data.activityCount}
                    termsSnapshotCount={preview.data.termsSnapshotCount}
                  />
                  <p className="text-sm">
                    If this was a real account, close it instead to keep
                    statements and other records.
                  </p>
                </>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requiresTypedName && preview.data ? (
          <div className="space-y-2 px-1">
            <Label htmlFor="delete-account-confirm">
              Type the account name to confirm
            </Label>
            <Input
              id="delete-account-confirm"
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              placeholder={displayName}
              autoComplete="off"
              disabled={pending}
            />
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!canDelete}
            onClick={(event) => {
              event.preventDefault();
              deleteAccount.mutate({ id: accountId });
            }}
          >
            {pending ? "Deleting…" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
