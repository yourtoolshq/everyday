"use client";

import "~/styles/globals.css";

import { Button } from "@yourtoolshq/ui/button";
import { StatusMessage } from "@yourtoolshq/ui/status-message";

export default function FirstAidGlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <StatusMessage
          title="First Aid couldn't open this page."
          description="Something went wrong while loading. Try again."
        >
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
        </StatusMessage>
      </body>
    </html>
  );
}
