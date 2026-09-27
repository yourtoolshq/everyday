import Link from "next/link";

import { StatusMessage } from "@yourtoolshq/ui/status-message";

export default function PassbookNotFound() {
  return (
    <StatusMessage
      title="That Passbook page isn't here."
      description="The link may be out of date. Return to the overview and continue from there."
    >
      <Link
        href="/"
        className="text-sm font-medium underline underline-offset-4"
      >
        Overview
      </Link>
    </StatusMessage>
  );
}
