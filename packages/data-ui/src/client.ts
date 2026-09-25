import { createTRPCClient, httpLink } from "@trpc/client";

import type { DataRouter } from "@yourtoolshq/data";

export const dataClient = createTRPCClient<DataRouter>({
  links: [httpLink({ url: "/api/data/trpc" })],
});

const backupListeners = new Set<() => void>();

export function onBackupsChanged(listener: () => void) {
  backupListeners.add(listener);
  return () => {
    backupListeners.delete(listener);
  };
}

export function notifyBackupsChanged() {
  for (const listener of backupListeners) listener();
}

export function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
