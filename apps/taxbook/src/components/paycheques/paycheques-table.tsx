"use client";

import { IconDots, IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";

import {
  TenureEmploymentLink,
  TenureEmploymentTag,
} from "~/components/tenure/tenure-external-link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { calculateTotalDeductions } from "~/domain/employment";
import { formatCad } from "~/domain/money";
import { type RouterOutputs } from "~/trpc/react";

type Paycheque = RouterOutputs["paycheque"]["list"]["items"][number];

function formatPayDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function PaychequesTable({
  items,
  totalCount,
  hasEmployments,
  onAdd,
  onEdit,
  onEditEmployment,
  onDelete,
}: {
  items: Paycheque[];
  totalCount: number;
  hasEmployments: boolean;
  onAdd: () => void;
  onEdit: (paycheque: Paycheque) => void;
  onEditEmployment: (employmentId: number) => void;
  onDelete: (paycheque: Paycheque) => void;
}) {
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="p-0">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow>
              <TableHead>Pay date</TableHead>
              <TableHead>Person</TableHead>
              <TableHead>Employer</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length ? (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button
                        className="hover:text-primary font-medium"
                        onClick={() => !item.syncedFromTenure && onEdit(item)}
                        disabled={item.syncedFromTenure}
                      >
                        {formatPayDate(item.payDate)}
                      </button>
                      {item.syncedFromTenure && item.tenureEmploymentId ? (
                        <TenureEmploymentTag
                          employmentId={item.tenureEmploymentId}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{item.personName}</TableCell>
                  <TableCell>
                    <button
                      className="hover:text-primary"
                      onClick={() => onEditEmployment(item.employmentId)}
                    >
                      {item.employerName}
                    </button>
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
                  <TableCell>
                    {item.syncedFromTenure && item.tenureEmploymentId ? (
                      <TenureEmploymentLink
                        employmentId={item.tenureEmploymentId}
                        className="text-muted-foreground hover:text-primary text-xs"
                      >
                        Open in Tenure
                      </TenureEmploymentLink>
                    ) : item.syncedFromTenure ? (
                      <span className="text-muted-foreground text-xs">
                        Read-only
                      </span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for paycheque on ${item.payDate}`}
                          >
                            <IconDots />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => onEdit(item)}>
                            <IconEdit /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => onDelete(item)}
                          >
                            <IconTrash /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-64 text-center">
                  <div className="flex flex-col items-center">
                    <p className="font-medium">
                      {totalCount === 0
                        ? "No paycheques yet"
                        : "No paycheques match these filters"}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {totalCount === 0
                        ? hasEmployments
                          ? "Add the first paycheque for this tax year."
                          : "Add an employment before recording a paycheque."
                        : "Try changing the person or employer filter."}
                    </p>
                    {totalCount === 0 && hasEmployments ? (
                      <Button
                        className="mt-4"
                        variant="outline"
                        onClick={onAdd}
                      >
                        <IconPlus /> Add paycheque
                      </Button>
                    ) : null}
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
