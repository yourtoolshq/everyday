"use client";

import {
  IconDots,
  IconDownload,
  IconExternalLink,
  IconPlus,
} from "@tabler/icons-react";

import type { RouterOutputs } from "~/trpc/react";
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
import { taxDocumentDisplayType } from "~/domain/tax-document";
import { TaxDocumentStatusBadge } from "./tax-document-status-badge";

type TaxDocument = RouterOutputs["taxDocument"]["list"]["items"][number];

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaxDocumentsTable({
  items,
  onAdd,
  onEdit,
  onDelete,
}: {
  items: TaxDocument[];
  onAdd: () => void;
  onEdit: (document: TaxDocument) => void;
  onDelete: (document: TaxDocument) => void;
}) {
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Issuer</TableHead>
              <TableHead>Person</TableHead>
              <TableHead>Attachment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length ? (
              items.map((document) => (
                <TableRow key={document.id}>
                  <TableCell>
                    <button
                      className="hover:text-primary max-w-64 truncate text-left font-medium"
                      onClick={() => onEdit(document)}
                    >
                      {taxDocumentDisplayType(document)}
                    </button>
                    {document.notes ? (
                      <p className="text-muted-foreground max-w-64 truncate text-xs">
                        {document.notes}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>{document.issuer}</TableCell>
                  <TableCell>{document.personName ?? "—"}</TableCell>
                  <TableCell>
                    {document.attachmentFileName ? (
                      <div className="flex max-w-60 items-center gap-1">
                        <a
                          className="text-primary truncate text-sm hover:underline"
                          href={`/api/tax-documents/${document.id}/attachment`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {document.attachmentFileName}
                        </a>
                        <span className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatSize(document.attachmentSizeBytes!)}
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <TaxDocumentStatusBadge status={document.status} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${taxDocumentDisplayType(document)} from ${document.issuer}`}
                        >
                          <IconDots />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onEdit(document)}>
                          Edit
                        </DropdownMenuItem>
                        {document.attachmentFileName ? (
                          <>
                            <DropdownMenuItem asChild>
                              <a
                                href={`/api/tax-documents/${document.id}/attachment`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <IconExternalLink /> Open attachment
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a
                                href={`/api/tax-documents/${document.id}/attachment?download=1`}
                              >
                                <IconDownload /> Download attachment
                              </a>
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => onDelete(document)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center">
                    <p className="font-medium">No Tax Documents yet</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Add the first official document expected for this item.
                    </p>
                    <Button className="mt-4" variant="outline" onClick={onAdd}>
                      <IconPlus /> Add Tax Document
                    </Button>
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
