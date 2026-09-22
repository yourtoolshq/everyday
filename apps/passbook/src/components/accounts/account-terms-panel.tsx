"use client";

import { useState } from "react";
import { History, Link2, Pencil, Plus } from "lucide-react";

import type { RouterOutputs } from "~/trpc/react";
import { AccountTermsSheet } from "~/components/accounts/account-terms-sheet";
import { AccountTermsSnapshotDetailSheet } from "~/components/accounts/account-terms-snapshot-detail-sheet";
import { AccountTermsSnapshotSheet } from "~/components/accounts/account-terms-snapshot-sheet";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { hasAccountTerms, listAccountTermsEntries } from "~/lib/account-terms";
import { formatDateLabel } from "~/lib/format-date";
import { formatTermValue } from "~/lib/format-term-value";
import { api } from "~/trpc/react";

type Snapshot = RouterOutputs["accountTerms"]["listSnapshots"][number];

export function AccountTermsPanel({ accountId }: { accountId: string }) {
  const terms = api.accountTerms.getCurrent.useQuery({ accountId });
  const snapshots = api.accountTerms.listSnapshots.useQuery({ accountId });

  const [editOpen, setEditOpen] = useState(false);
  const [addSnapshotOpen, setAddSnapshotOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(
    null,
  );

  if (terms.isLoading || snapshots.isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (terms.error || snapshots.error || !terms.data) {
    return (
      <Card className="shadow-none">
        <CardContent className="text-destructive p-4 text-sm">
          {terms.error?.message ??
            snapshots.error?.message ??
            "Unable to load account terms."}
        </CardContent>
      </Card>
    );
  }

  const currentEntries = listAccountTermsEntries(terms.data);
  const snapshotList = snapshots.data ?? [];

  return (
    <>
      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base">Terms</CardTitle>
            <p className="text-muted-foreground text-sm">
              Operational details about this account&apos;s relationship with
              the institution.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditOpen(true)}
            >
              <Pencil />
              Edit terms
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAddSnapshotOpen(true)}
            >
              <Plus />
              Add snapshot
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasAccountTerms(terms.data) ? (
            <p className="text-muted-foreground text-sm">
              No terms recorded yet.
            </p>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              {currentEntries.map((entry) => (
                <div key={entry.field} className="space-y-1">
                  <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {entry.label}
                  </dt>
                  <dd className="text-sm">
                    {formatTermValue(entry.field, entry.value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <History className="text-muted-foreground size-4" />
              History
            </div>
            {snapshotList.length === 0 ? (
              <p className="text-muted-foreground text-sm">No snapshots yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {snapshotList.map((snapshot) => {
                  const entries = listAccountTermsEntries(snapshot.terms);
                  return (
                    <li key={snapshot.id}>
                      <button
                        type="button"
                        className="hover:bg-muted/40 w-full space-y-2 p-3 text-left text-sm"
                        onClick={() => setSelectedSnapshot(snapshot)}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">
                                {formatDateLabel(snapshot.effectiveDate) ??
                                  snapshot.effectiveDate}
                              </p>
                              {snapshot.linkedActivity ? (
                                <Badge variant="secondary">
                                  <Link2 />
                                  Activity
                                </Badge>
                              ) : null}
                            </div>
                            {snapshot.notes ? (
                              <p className="text-muted-foreground line-clamp-2">
                                {snapshot.notes}
                              </p>
                            ) : null}
                            {snapshot.linkedActivity ? (
                              <p className="text-muted-foreground text-xs">
                                {snapshot.linkedActivity.title}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        {entries.length > 0 ? (
                          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                            {entries.slice(0, 3).map((entry) => (
                              <span key={entry.field}>
                                {entry.label}:{" "}
                                <span className="text-foreground">
                                  {formatTermValue(entry.field, entry.value)}
                                </span>
                              </span>
                            ))}
                            {entries.length > 3 ? (
                              <span className="text-foreground">
                                +{entries.length - 3} more
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-muted-foreground">
                            No values recorded.
                          </p>
                        )}
                      </button>
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

      {addSnapshotOpen ? (
        <AccountTermsSnapshotSheet
          key="new-snapshot"
          accountId={accountId}
          snapshot={null}
          open={addSnapshotOpen}
          onOpenChange={setAddSnapshotOpen}
        />
      ) : null}

      {selectedSnapshot ? (
        <AccountTermsSnapshotDetailSheet
          accountId={accountId}
          snapshot={
            snapshotList.find((item) => item.id === selectedSnapshot.id) ??
            selectedSnapshot
          }
          open={Boolean(selectedSnapshot)}
          onOpenChange={(open) => {
            if (!open) setSelectedSnapshot(null);
          }}
        />
      ) : null}
    </>
  );
}
