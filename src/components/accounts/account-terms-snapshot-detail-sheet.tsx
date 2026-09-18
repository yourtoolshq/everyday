"use client";

import Link from "next/link";
import { Link2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AccountTermsSnapshotSheet } from "~/components/accounts/account-terms-snapshot-sheet";
import {
  accountTermsFieldLabels,
  listAccountTermsEntries,
  type AccountTermsField,
} from "~/lib/account-terms";
import { formatDateLabel } from "~/lib/format-date";
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
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { api, type RouterOutputs } from "~/trpc/react";

type Snapshot = RouterOutputs["accountTerms"]["listSnapshots"][number];

function formatTermValue(field: AccountTermsField, value: string) {
  if (field === "renewalDate" || field === "promotionalInterestRateExpires") {
    return formatDateLabel(value) ?? value;
  }
  return value;
}

export function AccountTermsSnapshotDetailSheet({
  accountId,
  snapshot,
  open,
  onOpenChange,
}: {
  accountId: string;
  snapshot: Snapshot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteSnapshot = api.accountTerms.deleteSnapshot.useMutation({
    onSuccess: async () => {
      await utils.accountTerms.invalidate();
      toast.success("Snapshot deleted.");
      setDeleteOpen(false);
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  if (!snapshot) return null;

  const entries = listAccountTermsEntries(snapshot.terms);
  const isLinked = Boolean(snapshot.linkedActivity);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <div className="space-y-2">
              {isLinked ? <Badge variant="secondary">Linked to activity</Badge> : null}
              <SheetTitle>
                {formatDateLabel(snapshot.effectiveDate) ?? snapshot.effectiveDate}
              </SheetTitle>
              <SheetDescription>Terms snapshot</SheetDescription>
            </div>
          </SheetHeader>

          <div className="space-y-6 px-4 py-6">
            {isLinked ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium">Recorded from an activity</p>
                <p className="mt-1 text-muted-foreground">
                  This snapshot is linked to &quot;{snapshot.linkedActivity?.title}&quot;. To change
                  the terms recorded with that conversation, edit the activity instead.
                </p>
                {snapshot.linkedActivity ? (
                  <Button type="button" variant="link" className="mt-2 h-auto p-0" asChild>
                    <Link href={`/activity/${snapshot.linkedActivity.id}`}>
                      <Link2 />
                      View activity
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}

            {snapshot.notes ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Notes</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{snapshot.notes}</p>
              </div>
            ) : null}

            <div className="space-y-3">
              <h3 className="text-sm font-medium">Terms</h3>
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No values recorded.</p>
              ) : (
                <dl className="grid gap-3 sm:grid-cols-2">
                  {entries.map((entry) => (
                    <div key={entry.field} className="space-y-1">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {accountTermsFieldLabels[entry.field]}
                      </dt>
                      <dd className="text-sm">{formatTermValue(entry.field, entry.value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>

          <SheetFooter>
            {isLinked && snapshot.linkedActivity ? (
              <Button type="button" variant="outline" asChild>
                <Link href={`/activity/${snapshot.linkedActivity.id}`}>
                  <Link2 />
                  View activity
                </Link>
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil />
                  Edit
                </Button>
                <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 />
                  Delete
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {!isLinked && editOpen ? (
        <AccountTermsSnapshotSheet
          key={snapshot.id}
          accountId={accountId}
          snapshot={snapshot}
          open={editOpen}
          onOpenChange={(nextOpen) => {
            setEditOpen(nextOpen);
            if (!nextOpen) void utils.accountTerms.invalidate();
          }}
        />
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete snapshot?</AlertDialogTitle>
            <AlertDialogDescription>
              The snapshot from{" "}
              {formatDateLabel(snapshot.effectiveDate) ?? snapshot.effectiveDate} will be removed
              permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSnapshot.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteSnapshot.isPending}
              onClick={(event) => {
                event.preventDefault();
                deleteSnapshot.mutate({ id: snapshot.id });
              }}
            >
              {deleteSnapshot.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
