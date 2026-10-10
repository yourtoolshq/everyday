"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@yourtoolshq/ui/button";
import { Input } from "@yourtoolshq/ui/input";
import { Label } from "@yourtoolshq/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@yourtoolshq/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@yourtoolshq/ui/sheet";
import { Textarea } from "@yourtoolshq/ui/textarea";

import { invalidateInvestmentCaches } from "~/components/investment-statements/investment-invalidation";
import {
  identifierKindLabels,
  instrumentKindLabels,
} from "~/components/investment-statements/investment-labels";
import { api } from "~/trpc/react";

export type InstrumentIdentifier = {
  kind: "ticker" | "fund_code" | "isin" | "cusip";
  value: string;
  namespace: string | null;
};

export type InstrumentRecord = {
  id: string;
  displayName: string;
  kind: "stock" | "etf" | "mutual_fund" | "other";
  series: string | null;
  notes: string | null;
  identifiers: InstrumentIdentifier[];
};

type InstrumentPickerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (instrument: InstrumentRecord) => void;
  accountId: string;
  documentId: string;
  initialName?: string;
};

export function InstrumentPickerSheet({
  open,
  onOpenChange,
  onSelect,
  accountId,
  documentId,
  initialName = "",
}: InstrumentPickerSheetProps) {
  const instruments = api.investmentInstruments.list.useQuery(undefined, {
    enabled: open,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const list = (instruments.data ?? []) as InstrumentRecord[];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => {
      const haystack = [
        item.displayName,
        item.series,
        ...item.identifiers.map(
          (id) => `${id.kind}:${id.value} ${id.namespace ?? ""}`,
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [instruments.data, query]);

  return (
    <>
      <Sheet open={open && !createOpen} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Reuse instrument</SheetTitle>
            <SheetDescription>
              Pick a catalog instrument. Matching uses confirmed identifiers,
              not ticker or name alone.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4">
            <Label htmlFor="instrument-search">Search</Label>
            <Input
              id="instrument-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, symbol, exchange, fund code, or series"
            />
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {instruments.isLoading ? (
                <p className="text-muted-foreground text-sm">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No instruments match. Create a new one instead.
                </p>
              ) : (
                filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="hover:bg-muted/60 w-full rounded-lg border p-3 text-left text-sm"
                    onClick={() => {
                      onSelect(item);
                      onOpenChange(false);
                    }}
                  >
                    <p className="font-medium">{item.displayName}</p>
                    <p className="text-muted-foreground text-xs">
                      {instrumentKindLabels[item.kind]}
                      {item.series ? ` · Series ${item.series}` : ""}
                    </p>
                    {item.identifiers.length > 0 ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {item.identifiers
                          .map(
                            (id) =>
                              `${identifierKindLabels[id.kind]} ${id.value}${id.namespace ? ` (${id.namespace})` : ""}`,
                          )
                          .join(" · ")}
                      </p>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
          <SheetFooter className="flex-row justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(true)}
            >
              <Plus />
              New instrument
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {createOpen ? (
        <InstrumentCreateSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          accountId={accountId}
          documentId={documentId}
          initialName={query || initialName}
          onCreated={(instrument) => {
            onSelect(instrument);
            onOpenChange(false);
            setCreateOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

export function InstrumentCreateSheet({
  open,
  onOpenChange,
  accountId,
  documentId,
  onCreated,
  initialName = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  documentId: string;
  onCreated: (instrument: InstrumentRecord) => void;
  initialName?: string;
}) {
  const utils = api.useUtils();
  const [displayName, setDisplayName] = useState(initialName);
  const [kind, setKind] = useState<InstrumentRecord["kind"]>("etf");
  const [series, setSeries] = useState("");
  const [notes, setNotes] = useState("");
  const [identifiers, setIdentifiers] = useState<InstrumentIdentifier[]>([
    { kind: "ticker", value: "", namespace: null },
  ]);

  const create = api.investmentInstruments.create.useMutation({
    onSuccess: async (instrument) => {
      await invalidateInvestmentCaches(utils, { accountId, documentId });
      toast.success("Instrument added to catalog.");
      onCreated(instrument as InstrumentRecord);
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Create instrument</SheetTitle>
          <SheetDescription>
            Add a reusable holding identity for this Passbook database.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <div className="space-y-2">
            <Label htmlFor="instrument-name">Display name</Label>
            <Input
              id="instrument-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instrument-kind">Kind</Label>
            <Select
              value={kind}
              onValueChange={(value) =>
                setKind(value as InstrumentRecord["kind"])
              }
            >
              <SelectTrigger id="instrument-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(instrumentKindLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="instrument-series">Series (mutual funds)</Label>
            <Input
              id="instrument-series"
              value={series}
              onChange={(event) => setSeries(event.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label>Symbols and identifiers</Label>
            <p className="text-muted-foreground text-xs">
              A ticker is identified together with its exchange. Fund codes use
              the issuer; mutual funds also need a series.
            </p>
            {identifiers.map((identifier, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor={`identifier-kind-${index}`}>
                    Identifier type
                  </Label>
                  <Select
                    value={identifier.kind}
                    onValueChange={(value) => {
                      const next = [...identifiers];
                      next[index] = {
                        ...identifier,
                        kind: value as InstrumentIdentifier["kind"],
                      };
                      setIdentifiers(next);
                    }}
                  >
                    <SelectTrigger id={`identifier-kind-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(identifierKindLabels).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`identifier-value-${index}`}>
                    {identifier.kind === "ticker"
                      ? "Symbol"
                      : identifierKindLabels[identifier.kind]}
                  </Label>
                  <Input
                    id={`identifier-value-${index}`}
                    value={identifier.value}
                    onChange={(event) => {
                      const next = [...identifiers];
                      next[index] = {
                        ...identifier,
                        value: event.target.value,
                      };
                      setIdentifiers(next);
                    }}
                    aria-label={`${identifierKindLabels[identifier.kind]} value ${index + 1}`}
                    placeholder={
                      identifier.kind === "ticker"
                        ? "Symbol (e.g. EXEQ)"
                        : "Identifier value"
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`identifier-namespace-${index}`}>
                    {identifier.kind === "ticker"
                      ? "Exchange"
                      : "Issuer / namespace"}
                  </Label>
                  <Input
                    id={`identifier-namespace-${index}`}
                    value={identifier.namespace ?? ""}
                    onChange={(event) => {
                      const next = [...identifiers];
                      next[index] = {
                        ...identifier,
                        namespace: event.target.value || null,
                      };
                      setIdentifiers(next);
                    }}
                    aria-label={`${identifier.kind === "ticker" ? "Exchange" : "Issuer / namespace"} ${index + 1}`}
                    placeholder={
                      identifier.kind === "ticker"
                        ? "Exchange (e.g. TSX)"
                        : "Issuer / namespace"
                    }
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setIdentifiers([
                  ...identifiers,
                  { kind: "ticker", value: "", namespace: null },
                ])
              }
            >
              <Plus />
              Add identifier
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="instrument-notes">Notes</Label>
            <Textarea
              id="instrument-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>
        <SheetFooter>
          <Button
            type="button"
            disabled={create.isPending || !displayName.trim()}
            onClick={() =>
              create.mutate({
                displayName: displayName.trim(),
                kind,
                series: series.trim() || null,
                notes: notes.trim() || null,
                identifiers: identifiers
                  .filter((row) => row.value.trim())
                  .map((row) => ({
                    kind: row.kind,
                    value: row.value.trim(),
                    namespace: row.namespace?.trim() || null,
                  })),
              })
            }
          >
            Save instrument
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
