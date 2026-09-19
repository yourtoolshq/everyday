"use client";

import {
  IconArrowsSort,
  IconDots,
  IconEdit,
  IconPlus,
  IconReceiptDollar,
  IconTrash,
  IconBriefcase,
} from "@tabler/icons-react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatCad } from "~/domain/money";
import {
  itemStatuses,
  itemStatusLabels,
  itemTypes,
  itemTypeLabels,
  taxTreatmentLabels,
} from "~/domain/tax-item";
import { type RouterOutputs } from "~/trpc/react";
import { TenureEmploymentTag } from "~/components/tenure/tenure-external-link";
import { ItemStatusBadge } from "./item-status-badge";

type TaxItem = RouterOutputs["taxItem"]["list"]["items"][number];
type Person = RouterOutputs["settings"]["get"]["people"][number];
const columnHelper = createColumnHelper<TaxItem>();

export function TaxItemsTable({
  items,
  people,
  onAdd,
  onEdit,
  onDelete,
}: {
  items: TaxItem[];
  people: Person[];
  onAdd: () => void;
  onEdit: (item: TaxItem) => void;
  onDelete: (item: TaxItem) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [search, setSearch] = useState("");
  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Item",
        cell: (info) => (
          <div className="max-w-64">
            <Link className="block truncate font-medium hover:text-primary hover:underline" href={`/items/${info.row.original.id}`}>{info.getValue()}</Link>
            {info.row.original.valueSource === "paycheques" ? (
              <div className="mt-0.5 flex items-center gap-1.5">
                <p className="truncate text-xs text-muted-foreground">
                  {info.row.original.tenureEmploymentId
                    ? "Pay stubs from Tenure"
                    : "Calculated from paycheques"}
                </p>
                {info.row.original.tenureEmploymentId ? (
                  <TenureEmploymentTag employmentId={info.row.original.tenureEmploymentId} />
                ) : null}
              </div>
            ) : info.row.original.valueSource === "self_employment" ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">Calculated from self-employment Records</p>
            ) : info.row.original.notes ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{info.row.original.notes}</p>
            ) : null}
            {info.row.original.taxTreatment ? <p className="mt-0.5 truncate text-xs text-primary">{taxTreatmentLabels[info.row.original.taxTreatment]}</p> : null}
          </div>
        ),
      }),
      columnHelper.accessor("taxLineReference", {
        header: "Tax reference",
        cell: (info) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {info.getValue() ?? "—"}
          </span>
        ),
      }),
      columnHelper.accessor("type", {
        header: "Type",
        cell: (info) => itemTypeLabels[info.getValue()],
        filterFn: "equals",
      }),
      columnHelper.accessor((item) => item.personName ?? "Household", {
        id: "owner",
        header: "Owner",
        filterFn: "equals",
      }),
      columnHelper.accessor("expectedAmountCents", {
        header: "Expected",
        cell: (info) => <span className="tabular-nums">{formatCad(info.getValue())}</span>,
      }),
      columnHelper.accessor("actualAmountCents", {
        header: "Actual",
        cell: (info) => <span className="font-medium tabular-nums">{formatCad(info.getValue())}</span>,
      }),
      columnHelper.accessor(
        (item) =>
          item.expectedAmountCents !== null && item.actualAmountCents !== null
            ? item.actualAmountCents - item.expectedAmountCents
            : null,
        {
          id: "variance",
          header: "Variance",
          cell: (info) => {
            const value = info.getValue();
            return <span className="tabular-nums text-muted-foreground">{formatCad(value)}</span>;
          },
        },
      ),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <ItemStatusBadge status={info.getValue()} />,
        filterFn: "equals",
      }),
      columnHelper.accessor("updatedAt", {
        header: "Updated",
        cell: (info) => <span className="whitespace-nowrap text-muted-foreground">{new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(info.getValue())}</span>,
      }),
      columnHelper.display({
        id: "actions",
        cell: (info) => info.row.original.valueSource === "paycheques" ? (
          info.row.original.tenureEmploymentId ? (
            <Button variant="ghost" size="icon" asChild aria-label={`View ${info.row.original.name}`}>
              <Link href={`/items/${info.row.original.id}`}><IconReceiptDollar /></Link>
            </Button>
          ) : (
            <Button variant="ghost" size="icon" asChild aria-label={`Manage ${info.row.original.name} paycheques`}>
              <Link href="/paycheques"><IconReceiptDollar /></Link>
            </Button>
          )
        ) : info.row.original.valueSource === "self_employment" ? (
          <Button variant="ghost" size="icon" asChild aria-label={`Manage ${info.row.original.name}`}><Link href={`/self-employment/${info.row.original.businessActivityId}`}><IconBriefcase /></Link></Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${info.row.original.name}`}><IconDots /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(info.row.original)}><IconEdit /> Edit</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(info.row.original)}><IconTrash /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      }),
    ],
    [onDelete, onEdit],
  );

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Card className="overflow-hidden py-0">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <Input className="w-72" placeholder="Search tax items…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select value={(table.getColumn("type")?.getFilterValue() as string) ?? "all"} onValueChange={(value) => table.getColumn("type")?.setFilterValue(value === "all" ? undefined : value)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All types</SelectItem>{itemTypes.map((value) => <SelectItem key={value} value={value}>{itemTypeLabels[value]}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={(table.getColumn("owner")?.getFilterValue() as string) ?? "all"} onValueChange={(value) => table.getColumn("owner")?.setFilterValue(value === "all" ? undefined : value)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All owners" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All owners</SelectItem><SelectItem value="Household">Household</SelectItem>{people.map((person) => <SelectItem key={person.id} value={person.name}>{person.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={(table.getColumn("status")?.getFilterValue() as string) ?? "all"} onValueChange={(value) => table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{itemStatuses.map((value) => <SelectItem key={value} value={value}>{itemStatusLabels[value]}</SelectItem>)}</SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{table.getFilteredRowModel().rows.length} shown</span>
      </div>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button className="inline-flex items-center gap-1 whitespace-nowrap" onClick={header.column.getToggleSortingHandler()} disabled={!header.column.getCanSort()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() ? <IconArrowsSort className="size-3.5 text-muted-foreground" /> : null}
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-64 text-center">
                  <div className="flex flex-col items-center">
                    <p className="font-medium">{items.length === 0 ? "No tax items yet" : "No items match these filters"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{items.length === 0 ? "Add the first item for this tax year." : "Try changing your search or filters."}</p>
                    {items.length === 0 ? <Button className="mt-4" variant="outline" onClick={onAdd}><IconPlus /> Add tax item</Button> : null}
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
