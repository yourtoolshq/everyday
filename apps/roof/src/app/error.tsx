"use client";

import Link from "next/link";

import { Button } from "@yourtoolshq/ui/button";
import { StatusMessage } from "@yourtoolshq/ui/status-message";

export default function FirstAidError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StatusMessage
      title="First Aid couldn't open this page."
      description="Something went wrong while loading. Try again, or return to the overview."
    >
      <Button type="button" onClick={() => reset()}>
        Try again
      </Button>
      <Button variant="outline" asChild>
        <Link href="/">Overview</Link>
      </Button>
    </StatusMessage>
  );
}
