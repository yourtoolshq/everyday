import { IconAlertTriangle, IconChevronRight } from "@tabler/icons-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { EstimateData } from "./types";

export function EstimateWarnings({ data }: { data: EstimateData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconAlertTriangle className="size-5 text-amber-600" />
          Assumptions and warnings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.warnings.map((warning, index) => (
          <div key={`${warning.code}-${index}`} className="text-sm">
            <p>{warning.message}</p>
            {warning.itemId ? (
              <Link
                className="inline-flex items-center text-xs text-primary hover:underline"
                href={`/items/${warning.itemId}`}
              >
                Review Tax Item
                <IconChevronRight className="size-3" />
              </Link>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
