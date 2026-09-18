"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { AccountEventSheet } from "~/components/accounts/account-event-sheet";
import { accountEventTypeLabels } from "~/lib/account-events";
import { formatDateLabel } from "~/lib/format-date";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

function sortEvents<T extends { startDate: string }>(events: T[]) {
  return [...events].sort((left, right) => right.startDate.localeCompare(left.startDate));
}

export function AccountActivityPanel({ accountId }: { accountId: string }) {
  const events = api.accountEvents.listByAccount.useQuery({ accountId });
  const [createOpen, setCreateOpen] = useState(false);
  const [createOpeningOpen, setCreateOpeningOpen] = useState(false);

  const sortedEvents = useMemo(
    () => sortEvents(events.data ?? []),
    [events.data],
  );

  if (events.isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (events.error) {
    return (
      <Card className="shadow-none">
        <CardContent className="p-4 text-sm text-destructive">
          {events.error.message}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base">Activity</CardTitle>
            <p className="text-sm text-muted-foreground">
              Opening records, correspondence, calls, and account changes with supporting files.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={() => setCreateOpeningOpen(true)}>
              Record opening
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sortedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activity yet. Record the account opening, a bank conversation, or a terms change.
            </p>
          ) : (
            <ul className="divide-y">
              {sortedEvents.map((event) => (
                <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/activity/${event.id}`}
                    className="flex items-start justify-between gap-3 text-left hover:opacity-90"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{event.title}</p>
                        <Badge variant="secondary">{accountEventTypeLabels[event.type]}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDateLabel(event.startDate) ?? event.startDate}
                        {event.resolvedDate
                          ? ` → ${formatDateLabel(event.resolvedDate) ?? event.resolvedDate}`
                          : ""}
                      </p>
                      {event.notes ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">{event.notes}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {event.documents.length > 0
                        ? `${event.documents.length} doc${event.documents.length === 1 ? "" : "s"}`
                        : event.termsSnapshotId
                          ? "Terms linked"
                          : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {createOpen ? (
        <AccountEventSheet
          accountId={accountId}
          open={createOpen}
          onOpenChange={setCreateOpen}
          redirectOnCreate
        />
      ) : null}

      {createOpeningOpen ? (
        <AccountEventSheet
          accountId={accountId}
          open={createOpeningOpen}
          onOpenChange={setCreateOpeningOpen}
          defaultType="opening"
          redirectOnCreate
        />
      ) : null}
    </>
  );
}
