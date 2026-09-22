"use client";

import { useMemo } from "react";
import Link from "next/link";

import { Badge } from "~/components/ui/badge";
import { accountEventTypeLabels } from "~/lib/account-events";
import { formatDateLabel } from "~/lib/format-date";
import { api } from "~/trpc/react";

export function ActivityWorkspace() {
  const events = api.accountEvents.overview.useQuery();

  const sortedEvents = useMemo(() => {
    return [...(events.data ?? [])].sort((left, right) =>
      right.startDate.localeCompare(left.startDate),
    );
  }, [events.data]);

  if (events.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading activity…</p>;
  }

  if (events.error) {
    return <p className="text-destructive text-sm">{events.error.message}</p>;
  }

  if (sortedEvents.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No activity yet. Record account openings, bank conversations, or account
        changes from an account page.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="bg-muted/40 text-muted-foreground border-b text-left">
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Account</th>
            <th className="px-4 py-3 font-medium">Dates</th>
            <th className="px-4 py-3 font-medium">Files</th>
          </tr>
        </thead>
        <tbody>
          {sortedEvents.map((event) => (
            <tr key={event.id} className="border-b last:border-b-0">
              <td className="px-4 py-3 font-medium">
                <Link
                  href={`/activity/${event.id}`}
                  className="text-primary hover:underline"
                >
                  {event.title}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Badge variant="secondary">
                  {accountEventTypeLabels[event.type]}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/accounts/${event.accountId}`}
                  className="text-primary hover:underline"
                >
                  {event.accountName}
                </Link>
                <p className="text-muted-foreground text-xs">
                  {event.institutionName}
                </p>
              </td>
              <td className="text-muted-foreground px-4 py-3">
                {formatDateLabel(event.startDate) ?? event.startDate}
                {event.resolvedDate
                  ? ` → ${formatDateLabel(event.resolvedDate) ?? event.resolvedDate}`
                  : ""}
              </td>
              <td className="text-muted-foreground px-4 py-3">
                {event.documents.length > 0
                  ? `${event.documents.length} doc${event.documents.length === 1 ? "" : "s"}`
                  : event.termsSnapshotId
                    ? "Terms linked"
                    : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
