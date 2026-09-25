import { CircleAlert, CircleCheck } from "lucide-react";

import type { Verification } from "@yourtoolshq/data";
import { Badge } from "@yourtoolshq/ui/badge";

export function VerificationBadge({
  verification,
}: {
  verification: Verification | null;
}) {
  if (verification?.status === "verified") {
    return (
      <Badge variant="secondary">
        <CircleCheck aria-hidden />
        Verified
      </Badge>
    );
  }
  if (verification?.status === "failed") {
    return (
      <Badge variant="destructive" title={verification.error}>
        <CircleAlert aria-hidden />
        Failed verification
      </Badge>
    );
  }
  return <Badge variant="outline">Not verified</Badge>;
}
