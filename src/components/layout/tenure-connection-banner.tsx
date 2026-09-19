"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { Button } from "~/components/ui/button";
import { TenureHomeButton } from "~/components/tenure/tenure-external-link";
import { api } from "~/trpc/react";

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export function TenureConnectionBanner() {
  const utils = api.useUtils();
  const status = api.tenureSync.status.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const syncNow = api.tenureSync.syncNow.useMutation({
    onSuccess: async () => {
      await Promise.all([
        status.refetch(),
        utils.paycheque.list.invalidate(),
        utils.employment.list.invalidate(),
        utils.taxItem.list.invalidate(),
        utils.taxItem.overview.invalidate(),
        utils.taxEstimate.get.invalidate(),
      ]);
    },
  });
  const syncRef = useRef(syncNow.mutate);
  syncRef.current = syncNow.mutate;

  useEffect(() => {
    if (!status.data?.connected || status.data.linkedEmploymentCount === 0) return;

    syncRef.current({ fullRefresh: false });

    const interval = window.setInterval(() => {
      syncRef.current({ fullRefresh: false });
    }, SYNC_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [status.data?.connected, status.data?.linkedEmploymentCount]);

  if (!status.data) return null;

  if (syncNow.isPending) {
    return (
      <div className="border-b bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        Syncing paycheck data from Tenure…
      </div>
    );
  }

  if (!status.data.connected) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
        <span>
          Tax Book cannot reach Tenure at {status.data.baseUrl}.{" "}
          {status.data.connectionError ?? "Check that Tenure is running."}
        </span>
        <div className="flex gap-2">
          <TenureHomeButton />
          <Button asChild size="sm" variant="outline">
            <Link href="/settings">Open settings</Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => syncNow.mutate({ fullRefresh: true })}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (status.data.lastSyncError) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
        <span>Last Tenure sync failed: {status.data.lastSyncError}</span>
        <div className="flex gap-2">
          <TenureHomeButton />
          <Button size="sm" variant="outline" onClick={() => syncNow.mutate({ fullRefresh: true })}>
            Retry sync
          </Button>
        </div>
      </div>
    );
  }

  if (status.data.linkedEmploymentCount > 0 && status.data.lastSyncAt) {
    const minutesAgo = Math.max(
      0,
      Math.round((Date.now() - new Date(status.data.lastSyncAt).getTime()) / 60_000),
    );
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-emerald-50 px-4 py-2 text-sm text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-100">
        <span>
          Tenure sync is healthy. Last synced{" "}
          {minutesAgo === 0 ? "just now" : `${minutesAgo} min ago`}.
        </span>
        <TenureHomeButton variant="outline" />
      </div>
    );
  }

  return null;
}
