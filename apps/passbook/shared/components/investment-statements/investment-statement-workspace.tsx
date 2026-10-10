"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Cloud,
  ExternalLink,
  Layers,
  ListChecks,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { filePreviewUrl } from "@yourtoolshq/data-ui";
import { Button } from "@yourtoolshq/ui/button";
import { DateField } from "@yourtoolshq/ui/date-field";
import { Label } from "@yourtoolshq/ui/label";
import { Skeleton } from "@yourtoolshq/ui/skeleton";
import { Textarea } from "@yourtoolshq/ui/textarea";

import type { InvestmentStatementFormState } from "./investment-form-state";
import type { EntryPreferences } from "~/modules/investment-statements/domain/entry-preferences";
import { formatDateLabel } from "~/lib/format-date";
import {
  rememberedPositions,
  suggestStatementDates,
} from "~/modules/investment-statements/domain/entry-helpers";
import { defaultEntryPreferences } from "~/modules/investment-statements/domain/entry-preferences";
import { api } from "~/trpc/react";
import { formStateFromSnapshot, toSaveCommand } from "./investment-form-state";
import {
  invalidateInvestmentCaches,
  isConflictError,
} from "./investment-invalidation";
import { InvestmentPositionsPanel } from "./investment-positions-panel";
import { InvestmentSummaryPanel } from "./investment-summary-panel";
import { RemoveEnrichmentDialog } from "./remove-enrichment-dialog";
import { StatementPdfPreview } from "./statement-pdf-preview";

const steps = [
  { id: "dates", label: "Dates", icon: CalendarDays },
  { id: "summary", label: "Summary", icon: ListChecks },
  { id: "holdings", label: "Holdings", icon: Layers },
] as const;

export function InvestmentStatementWorkspace({
  documentId,
}: {
  documentId: string;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const payload = api.investmentStatements.entry.useQuery({ documentId });
  const instruments = api.investmentInstruments.list.useQuery();
  const [form, setForm] = useState<InvestmentStatementFormState | null>(null);
  const [preferences, setPreferences] = useState<EntryPreferences>(
    defaultEntryPreferences,
  );
  const [activeTab, setActiveTab] = useState("dates");
  const [showPdfOnSmall, setShowPdfOnSmall] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [status, setStatus] = useState<"saved" | "dirty" | "saving" | "error">(
    "saved",
  );
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const current = useRef<InvestmentStatementFormState | null>(null);
  const draftRevision = useRef<string | null>(null);
  const persisted = useRef("");
  const queue = useRef<Promise<void>>(Promise.resolve());
  const preferenceQueue = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(true);
  const saveDraft = api.investmentStatements.saveDraft.useMutation();
  const publish = api.investmentStatements.publish.useMutation();
  const discardDraft = api.investmentStatements.discardDraft.useMutation();
  const savePreferences =
    api.investmentStatements.savePreferences.useMutation();
  const recoveryKey = `passbook:investment-draft:v1:${documentId}`;
  const document = payload.data?.document;
  const snapshot = payload.data?.snapshot ?? null;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!payload.data || current.current) return;
    const { document: doc, draft, snapshot: saved, history } = payload.data;
    const prefs = payload.data.preferences ?? defaultEntryPreferences;
    let next = formStateFromSnapshot(saved, doc.documentDate);
    if (draft)
      next = {
        ...next,
        ...draft.command,
        expectedRevision: draft.command.expectedRevision,
        coverageStart: draft.command.coverageStart ?? "",
        coverageEnd: draft.command.coverageEnd ?? "",
        notes: draft.command.notes ?? "",
      };
    else if (!saved) {
      const dates = suggestStatementDates(doc.periodKey);
      if (dates)
        next = {
          ...next,
          valuationDate: dates.end,
          coverageStart: dates.start,
          coverageEnd: dates.end,
        };
      next.totals = next.totals.map((row) => ({
        ...row,
        currency: prefs.currency,
      }));
      next.positions = rememberedPositions(history, next.valuationDate);
    }
    draftRevision.current = draft?.revision ?? null;
    persisted.current = draft || saved ? JSON.stringify(next) : "";
    try {
      const cached = localStorage.getItem(recoveryKey);
      if (cached) {
        const recovery = JSON.parse(cached) as {
          form: InvestmentStatementFormState;
          draftRevision: string | null;
        };
        if (
          recovery.draftRevision === draftRevision.current &&
          recovery.form.expectedRevision === next.expectedRevision
        )
          next = recovery.form;
      }
    } catch {
      /* Server draft remains the durable source if local recovery is unavailable. */
    }
    current.current = next;
    setForm(next);
    setPreferences(prefs);
    if (JSON.stringify(next) !== persisted.current) setStatus("dirty");
  }, [payload.data, recoveryKey, form]);

  function clearRecovery() {
    try {
      localStorage.removeItem(recoveryKey);
    } catch {
      /* Server facts remain authoritative if local storage is unavailable. */
    }
  }

  function change(next: InvestmentStatementFormState) {
    current.current = next;
    setForm(next);
    setStatus("dirty");
    setError(null);
    try {
      localStorage.setItem(
        recoveryKey,
        JSON.stringify({ form: next, draftRevision: draftRevision.current }),
      );
    } catch {
      setError(
        "Local recovery is unavailable. Keep this window open until the draft is saved.",
      );
    }
  }
  function flush(): Promise<void> {
    const work = queue.current
      .catch(() => {})
      .then(async () => {
        const next = current.current;
        if (!next || JSON.stringify(next) === persisted.current) return;
        if (conflict)
          throw new Error("Reload the latest draft before continuing.");
        const serialized = JSON.stringify(next);
        if (mounted.current) setStatus("saving");
        try {
          const saved = await saveDraft.mutateAsync({
            command: toSaveCommand(documentId, next),
            expectedDraftRevision: draftRevision.current,
          });
          draftRevision.current = saved.revision;
          persisted.current = serialized;
          if (
            current.current &&
            JSON.stringify(current.current) === serialized
          ) {
            clearRecovery();
            if (mounted.current) setStatus("saved");
          } else {
            try {
              localStorage.setItem(
                recoveryKey,
                JSON.stringify({
                  form: current.current,
                  draftRevision: saved.revision,
                }),
              );
            } catch {
              /* Existing recovery is retained. */
            }
          }
        } catch (cause) {
          if (mounted.current) {
            setStatus("error");
            setError(
              cause instanceof Error
                ? cause.message
                : "Couldn't save this draft.",
            );
            if (isConflictError(cause)) setConflict(true);
          }
          throw cause;
        }
      });
    queue.current = work;
    return work;
  }
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    if (!form || status !== "dirty") return;
    const timer = setTimeout(
      () => void flushRef.current().catch(() => {}),
      650,
    );
    return () => clearTimeout(timer);
  }, [form, status]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (
        current.current &&
        JSON.stringify(current.current) !== persisted.current
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      void flushRef.current().catch(() => {});
    };
  }, []);
  const names = useMemo(
    () =>
      Object.fromEntries(
        (instruments.data ?? []).map((item) => [
          item.id,
          item.identifiers.length
            ? item.identifiers
                .map(
                  (id) =>
                    `${id.value}${id.namespace ? ` / ${id.namespace}` : ""}`,
                )
                .join(", ")
            : item.displayName,
        ]),
      ),
    [instruments.data],
  );
  async function commit() {
    if (!current.current) return;
    setPublishing(true);
    setError(null);
    try {
      await flush();
      const next = current.current;
      const saved = await publish.mutateAsync({
        command: {
          ...toSaveCommand(documentId, next),
          summaryCoverage: next.totals.some(
            (row) => row.closingValue || row.bookCost || row.openingValue,
          )
            ? "partial"
            : "not_entered",
          holdingsCoverage: next.positions.length ? "partial" : "not_entered",
        },
        expectedDraftRevision: draftRevision.current!,
      });
      const updated = formStateFromSnapshot(saved);
      current.current = updated;
      persisted.current = JSON.stringify(updated);
      draftRevision.current = null;
      setForm(updated);
      setStatus("saved");
      clearRecovery();
      await invalidateInvestmentCaches(utils, {
        documentId,
        accountId: saved.accountId,
      });
      await payload.refetch();
      toast.success("Statement details saved.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't save statement details.",
      );
      if (isConflictError(cause)) setConflict(true);
    } finally {
      setPublishing(false);
    }
  }
  async function updatePreferences(next: EntryPreferences) {
    setPreferences(next);
    try {
      preferenceQueue.current = preferenceQueue.current
        .catch(() => {})
        .then(async () => {
          await savePreferences.mutateAsync({ documentId, preferences: next });
        });
      await preferenceQueue.current;
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Couldn't remember field choices.",
      );
    }
  }
  async function discard() {
    setPublishing(true);
    try {
      await queue.current.catch(() => {});
      if (draftRevision.current !== null)
        await discardDraft.mutateAsync({
          documentId,
          expectedRevision: draftRevision.current,
        });
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn't discard this draft.",
      );
    } finally {
      setPublishing(false);
    }
  }
  async function reload() {
    await payload.refetch();
    clearRecovery();
    current.current = null;
    setForm(null);
    setConflict(false);
    setError(null);
    setStatus("saved");
  }
  if (payload.isLoading || (!form && !payload.error))
    return <Skeleton className="h-[640px] w-full rounded-xl" />;
  if (payload.error || !document || !form)
    return (
      <div className="space-y-4">
        <Link href="/accounts">Back to accounts</Link>
        <p role="alert" className="text-destructive">
          {payload.error?.message ?? "Statement not found or not eligible."}
        </p>
        <Button onClick={() => void payload.refetch()}>Retry</Button>
      </div>
    );
  const stepIndex = steps.findIndex((step) => step.id === activeTab);
  const hasDraft =
    Boolean(payload.data?.draft) ||
    status !== "saved" ||
    draftRevision.current !== null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="mb-1 -ml-3" asChild>
            <Link
              href={`/accounts/${document.accountId}`}
              onClick={(event) => {
                event.preventDefault();
                void flush()
                  .then(() => router.push(`/accounts/${document.accountId}`))
                  .catch(() => {});
              }}
            >
              <ArrowLeft />
              {document.accountName}
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Statement details
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {document.title} ·{" "}
            {document.periodKey ?? formatDateLabel(document.documentDate)}
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="xl:hidden"
            aria-expanded={showPdfOnSmall}
            onClick={() => setShowPdfOnSmall(!showPdfOnSmall)}
          >
            {showPdfOnSmall ? "Hide PDF" : "View PDF"}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={filePreviewUrl({
                id: document.fileId,
                mimeType: document.mimeType,
              })}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink />
              Open source file
            </a>
          </Button>
          {snapshot ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRemoveOpen(true)}
            >
              Remove details
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 xl:h-[calc(100dvh-235px)] xl:min-h-[620px] xl:grid-cols-[minmax(340px,.7fr)_minmax(0,1.3fr)]">
        <div
          className={`h-[500px] min-w-0 xl:block xl:h-full ${showPdfOnSmall ? "block" : "hidden"}`}
        >
          {document.mimeType === "application/pdf" ? (
            <StatementPdfPreview
              url={filePreviewUrl({
                id: document.fileId,
                mimeType: document.mimeType,
              })}
              title={document.title}
            />
          ) : (
            <div className="h-full overflow-auto rounded-xl border">
              <Image
                src={filePreviewUrl({
                  id: document.fileId,
                  mimeType: document.mimeType,
                })}
                alt={document.title}
                width={1000}
                height={1400}
                className="h-auto w-full"
              />
            </div>
          )}
        </div>
        <div className="bg-card flex min-h-0 min-w-0 flex-col rounded-xl border">
          <nav
            className="grid grid-cols-3 gap-1 border-b p-3"
            aria-label="Statement sections"
          >
            {steps.map((step, index) => (
              <Button
                key={step.id}
                variant={activeTab === step.id ? "secondary" : "ghost"}
                className="justify-start gap-2"
                aria-pressed={activeTab === step.id}
                onClick={() => {
                  setActiveTab(step.id);
                  void flush().catch(() => {});
                }}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${activeTab === step.id ? "bg-primary text-primary-foreground" : "text-muted-foreground border"}`}
                >
                  {index + 1}
                </span>
                {step.label}
              </Button>
            ))}
          </nav>
          <fieldset
            disabled={publishing || conflict}
            className="m-0 min-h-0 min-w-0 flex-1 overflow-auto border-0 p-5 lg:p-6"
            onBlur={() => {
              void flush().catch(() => {});
            }}
          >
            {activeTab === "dates" ? (
              <section className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Statement dates</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Check the suggested period against your statement.
                  </p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="coverage-start">Coverage start</Label>
                    <DateField
                      id="coverage-start"
                      value={form.coverageStart}
                      onChange={(value) =>
                        change({ ...form, coverageStart: value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coverage-end">Coverage end</Label>
                    <DateField
                      id="coverage-end"
                      value={form.coverageEnd}
                      onChange={(value) =>
                        change({ ...form, coverageEnd: value })
                      }
                    />
                  </div>
                </div>
                <div className="max-w-xs space-y-2">
                  <Label htmlFor="valuation-date">Valuation date</Label>
                  <DateField
                    id="valuation-date"
                    value={form.valuationDate}
                    onChange={(value) =>
                      change({ ...form, valuationDate: value })
                    }
                  />
                  <p className="text-muted-foreground text-xs">
                    The date these balances and holdings apply, usually the
                    period end.
                  </p>
                </div>
                <details className="border-t pt-4">
                  <summary className="text-muted-foreground cursor-pointer text-sm">
                    Add a note
                  </summary>
                  <Label htmlFor="statement-notes" className="sr-only">
                    Statement note
                  </Label>
                  <Textarea
                    id="statement-notes"
                    className="mt-3"
                    value={form.notes}
                    onChange={(event) =>
                      change({ ...form, notes: event.target.value })
                    }
                    rows={3}
                  />
                </details>
              </section>
            ) : null}
            {activeTab === "summary" ? (
              <InvestmentSummaryPanel
                form={form}
                onChange={change}
                preferences={preferences}
                onPreferencesChange={(next) => void updatePreferences(next)}
              />
            ) : null}
            {activeTab === "holdings" ? (
              <InvestmentPositionsPanel
                form={form}
                onChange={change}
                accountId={document.accountId}
                documentId={documentId}
                instrumentNames={names}
              />
            ) : null}
          </fieldset>
          <div className="space-y-3 border-t p-4">
            {error ? (
              <div role="alert" className="text-destructive text-sm">
                {error}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    conflict ? void reload() : void flush().catch(() => {})
                  }
                >
                  <RotateCcw />
                  {conflict ? "Reload latest" : "Retry draft save"}
                </Button>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span
                className="text-muted-foreground flex items-center gap-1.5 text-xs"
                role="status"
              >
                {status === "saving" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : hasDraft ? (
                  <Cloud className="size-3.5" />
                ) : (
                  <Check className="size-3.5" />
                )}
                {status === "saving"
                  ? "Saving draft…"
                  : status === "error"
                    ? "Draft not saved"
                    : status === "dirty"
                      ? "Unsaved changes"
                      : hasDraft
                        ? "Draft saved"
                        : "Saved details"}
              </span>
              <div className="flex gap-2">
                {hasDraft ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={publishing || conflict}
                    onClick={() => void discard()}
                  >
                    Discard draft
                  </Button>
                ) : null}
                {stepIndex < 2 ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActiveTab(steps[stepIndex + 1]!.id);
                      void flush().catch(() => {});
                    }}
                  >
                    Continue to {steps[stepIndex + 1]!.label.toLowerCase()}
                  </Button>
                ) : null}
                <Button
                  disabled={publishing || conflict || !form.valuationDate}
                  onClick={() => void commit()}
                >
                  {publishing ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Check />
                  )}
                  Save details
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {snapshot && form.expectedRevision != null ? (
        <RemoveEnrichmentDialog
          open={removeOpen}
          onOpenChange={setRemoveOpen}
          documentId={documentId}
          accountId={document.accountId}
          expectedRevision={form.expectedRevision}
          onRemoved={async () => {
            await payload.refetch();
            clearRecovery();
            current.current = null;
            draftRevision.current = null;
            setForm(null);
          }}
        />
      ) : null}
    </div>
  );
}
