"use client";

import { IconDots, IconDownload, IconExternalLink, IconPlus } from "@tabler/icons-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { formatCad } from "~/domain/money";
import { type RouterOutputs } from "~/trpc/react";

type RecordItem = RouterOutputs["record"]["list"]["items"][number];

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RecordsTable({
  items,
  canAdd,
  onAdd,
  onEdit,
  onDelete,
}: {
  items: RecordItem[];
  canAdd: boolean;
  onAdd: () => void;
  onEdit: (record: RecordItem) => void;
  onDelete: (record: RecordItem) => void;
}) {
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Person</TableHead>
              <TableHead>Attachment</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length ? items.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="whitespace-nowrap">{new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${record.date}T00:00:00Z`))}</TableCell>
                <TableCell>
                  <button className="max-w-80 truncate text-left font-medium hover:text-primary" onClick={() => onEdit(record)}>{record.description}</button>
                  {record.notes ? <p className="max-w-80 truncate text-xs text-muted-foreground">{record.notes}</p> : null}
                </TableCell>
                <TableCell>{record.personName ?? "—"}</TableCell>
                <TableCell>
                  {record.attachmentFileName ? (
                    <div className="flex max-w-60 items-center gap-1">
                      <a className="truncate text-sm text-primary hover:underline" href={`/api/records/${record.id}/attachment`} target="_blank" rel="noreferrer">{record.attachmentFileName}</a>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">{formatSize(record.attachmentSizeBytes!)}</span>
                    </div>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatCad(record.amountCents)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${record.description}`}><IconDots /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEdit(record)}>Edit</DropdownMenuItem>
                      {record.attachmentFileName ? (
                        <>
                          <DropdownMenuItem asChild><a href={`/api/records/${record.id}/attachment`} target="_blank" rel="noreferrer"><IconExternalLink /> Open attachment</a></DropdownMenuItem>
                          <DropdownMenuItem asChild><a href={`/api/records/${record.id}/attachment?download=1`}><IconDownload /> Download attachment</a></DropdownMenuItem>
                        </>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => onDelete(record)}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="h-56 text-center">
                  <div className="flex flex-col items-center">
                    <p className="font-medium">No Records yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Add the first amount and its supporting information.</p>
                    {canAdd ? <Button className="mt-4" variant="outline" onClick={onAdd}><IconPlus /> Add Record</Button> : null}
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
