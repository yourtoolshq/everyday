"use client";

import { Card, CardContent } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  TenureEmploymentLink,
  TenureEmploymentTag,
} from "~/components/tenure/tenure-external-link";
import { calculateTotalDeductions } from "~/domain/employment";
import { formatCad } from "~/domain/money";
import { type RouterOutputs } from "~/trpc/react";

type Paycheque = RouterOutputs["taxItem"]["get"]["tenurePaycheques"][number];

function formatPayDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function TaxItemPaychequesTable({
  items,
  tenureEmploymentId,
}: {
  items: Paycheque[];
  tenureEmploymentId: string | null;
}) {
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pay date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length ? items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatPayDate(item.payDate)}</span>
                    {item.syncedFromTenure && tenureEmploymentId ? (
                      <TenureEmploymentTag employmentId={tenureEmploymentId} />
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <p className="font-medium">Pay stub</p>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCad(item.grossPayCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCad(calculateTotalDeductions(item))}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCad(item.netPayCents)}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center">
                  <div className="flex flex-col items-center">
                    <p className="font-medium">No pay stubs yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tenureEmploymentId ? (
                        <>
                          Pay stubs sync from{" "}
                          <TenureEmploymentLink employmentId={tenureEmploymentId}>
                            Tenure
                          </TenureEmploymentLink>{" "}
                          automatically.
                        </>
                      ) : (
                        "Pay stubs sync from Tenure automatically."
                      )}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
