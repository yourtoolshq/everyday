"use client";

import { History, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AccountTermsSheet } from "~/components/accounts/account-terms-sheet";
import { AccountTermsSnapshotSheet } from "~/components/accounts/account-terms-snapshot-sheet";
import {
  accountTermsFieldLabels,
  hasAccountTerms,
  listAccountTermsEntries,
  type AccountTermsField,
} from "~/lib/account-terms";
import { formatDateLabel } from "~/lib/format-date";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { api, type RouterOutputs } from "~/trpc/react";

type Snapshot = RouterOutputs["accountTerms"]["listSnapshots"][number];

function formatTermValue(field: AccountTermsField, value: string) {
  if (field === "renewalDate" || field === "promotionalInterestRateExpires") {
    return formatDateLabel(value) ?? value;
  }
  return value;
}

export function AccountTermsPanel({ accountId }: { accountId: string }) {
  const terms = api.accountTerms.getCurrent.useQuery({ accountId });
  const snapshots = api.accountTerms.listSnapshots.useQuery({ accountId });
  const utils = api.useUtils();

  const [editOpen, setEditOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState<Snapshot | null>(null);

  const deleteSnapshot = api.accountTerms.deleteSnapshot.useMutation({
    onSuccess: async () => {
      await utils.accountTerms.invalidate();
      toast.success("Snapshot deleted.");
    },
    onError: (error) => toast.error(error.message),
  });

  if (terms.isLoading || snapshots.isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (terms.error || snapshots.error || !terms.data) {
    return (
      <Card className="shadow-none">
        <CardContent className="p-4 text-sm text-destructive">
          {terms.error?.message ?? snapshots.error?.message ?? "Unable to load account terms."}
        </CardContent>
      </Card>
    );
  }

  const currentEntries = listAccountTermsEntries(terms.data);

  function openSnapshotEditor(snapshot: Snapshot | null) {
    setEditingSnapshot(snapshot);
    setSnapshotOpen(true);
  }

  return (
    <>
      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base">Terms</CardTitle>
            <p className="text-sm text-muted-foreground">
              Operational details about this account&apos;s relationship with the institution.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil />
              Edit terms
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openSnapshotEditor(null)}
            >
              <Plus />
              Add snapshot
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasAccountTerms(terms.data) ? (
            <p className="text-sm text-muted-foreground">No terms recorded yet.</p>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              {currentEntries.map((entry) => (
                <div key={entry.field} className="space-y-1">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {entry.label}
                  </dt>
                  <dd className="text-sm">{formatTermValue(entry.field, entry.value)}</dd>
                </div>
              ))}
            </dl>
          )}

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <History className="size-4 text-muted-foreground" />
              History
            </div>
            {(snapshots.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No snapshots yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {(snapshots.data ?? []).map((snapshot) => {
                  const entries = listAccountTermsEntries(snapshot.terms);
                  return (
                    <li key={snapshot.id} className="space-y-2 p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {formatDateLabel(snapshot.effectiveDate) ?? snapshot.effectiveDate}
                          </p>
                          {snapshot.notes ? (
                            <p className="text-muted-foreground">{snapshot.notes}</p>
                          ) : null}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => openSnapshotEditor(snapshot)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteSnapshot.mutate({ id: snapshot.id })}
                            disabled={deleteSnapshot.isPending}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                      {entries.length > 0 ? (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                          {entries.map((entry) => (
                            <span key={entry.field}>
                              {accountTermsFieldLabels[entry.field]}:{" "}
                              <span className="text-foreground">
                                {formatTermValue(entry.field, entry.value)}
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No values recorded.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {editOpen ? (
        <AccountTermsSheet
          key={`terms-${accountId}`}
          accountId={accountId}
          open={editOpen}
          onOpenChange={setEditOpen}
          initialTerms={terms.data}
        />
      ) : null}

      {snapshotOpen ? (
        <AccountTermsSnapshotSheet
          key={editingSnapshot?.id ?? "new-snapshot"}
          accountId={accountId}
          snapshot={editingSnapshot}
          open={snapshotOpen}
          onOpenChange={(open) => {
            setSnapshotOpen(open);
            if (!open) setEditingSnapshot(null);
          }}
        />
      ) : null}
    </>
  );
}
