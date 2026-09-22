"use client";

import { useState } from "react";
import Link from "next/link";
import { FileSearch, FileText } from "lucide-react";

import type { RouterOutputs } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { formatDateTime } from "~/lib/date-time";
import {
  documentTypeLabels,
  documentTypes,
  formatFileSize,
} from "~/lib/documents";
import { api } from "~/trpc/react";

type DocumentsOverview = RouterOutputs["documents"]["overview"];

export function DocumentsWorkspace({
  initialDocuments,
}: {
  initialDocuments: DocumentsOverview;
}) {
  const documents = api.documents.overview.useQuery(undefined, {
    initialData: initialDocuments,
  });
  const [search, setSearch] = useState("");
  const [personId, setPersonId] = useState("all");
  const [type, setType] = useState("all");
  const people = Array.from(
    new Map(
      documents.data.map((document) => [
        document.personId,
        document.personName,
      ]),
    ).entries(),
  );
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = documents.data.filter((document) => {
    if (personId !== "all" && document.personId !== personId) return false;
    if (type !== "all" && document.type !== type) return false;
    if (
      normalizedSearch &&
      !document.title.toLowerCase().includes(normalizedSearch) &&
      !document.originalFilename.toLowerCase().includes(normalizedSearch)
    )
      return false;
    return true;
  });

  return (
    <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div>
          <p className="text-primary text-sm font-medium">Healthcare records</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            Documents
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            Find files across the household while keeping each one connected to
            the visit that explains it.
          </p>
        </div>

        <Card className="shadow-none">
          <CardContent className="grid gap-4 p-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="document-search">Search</Label>
              <Input
                id="document-search"
                type="search"
                placeholder="Title or filename"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <FilterSelect
              label="Household member"
              value={personId}
              onValueChange={setPersonId}
              options={[
                { value: "all", label: "Everyone" },
                ...people.map(([id, name]) => ({ value: id, label: name })),
              ]}
            />
            <FilterSelect
              label="Document type"
              value={type}
              onValueChange={setType}
              options={[
                { value: "all", label: "All types" },
                ...documentTypes.map((value) => ({
                  value,
                  label: documentTypeLabels[value],
                })),
              ]}
            />
          </CardContent>
        </Card>

        {filtered.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileSearch className="text-muted-foreground mb-3 size-6" />
              <p className="font-medium">
                {documents.data.length === 0
                  ? "No documents yet"
                  : "No documents match"}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {documents.data.length === 0
                  ? "Add a document from a visit to see it here."
                  : "Try changing the search or filters."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((document) => (
              <Card key={document.id} className="shadow-none">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <FileText className="text-muted-foreground size-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{document.title}</h3>
                      <Badge variant="outline">
                        {documentTypeLabels[document.type]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm font-medium">
                      {document.visitTitle}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {document.personName} ·{" "}
                      {formatDateTime(document.visitStartsAt)}
                    </p>
                    <p className="text-muted-foreground mt-1 truncate text-sm">
                      {document.originalFilename} ·{" "}
                      {formatFileSize(document.sizeBytes)}
                    </p>
                    {document.claimBenefitName ? (
                      <p className="text-muted-foreground mt-1 text-sm">
                        Linked to {document.claimBenefitName} claim
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={`/api/documents/${document.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    </Button>
                    <Button asChild size="sm">
                      <Link href={`/visits/${document.visitId}`}>
                        View visit
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const id = `documents-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
