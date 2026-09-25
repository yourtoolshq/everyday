"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => undefined;

// The server renders UTC; the browser switches to its own time zone after hydration.
export function BackupTime({ iso }: { iso: string }) {
  const inBrowser = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const style = { dateStyle: "medium", timeStyle: "short" } as const;
  const date = new Date(iso);
  return (
    <time dateTime={iso}>
      {inBrowser
        ? date.toLocaleString(undefined, style)
        : `${date.toLocaleString("en-US", { ...style, timeZone: "UTC" })} UTC`}
    </time>
  );
}
