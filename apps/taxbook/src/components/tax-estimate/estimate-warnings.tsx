import Link from "next/link";
import { IconAlertTriangle, IconChevronRight } from "@tabler/icons-react";

import type { EstimateData } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

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
                className="text-primary inline-flex items-center text-xs hover:underline"
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
