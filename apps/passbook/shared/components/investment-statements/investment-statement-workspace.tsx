"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { filePreviewUrl } from "@yourtoolshq/data-ui";
import { Badge } from "@yourtoolshq/ui/badge";
import { Button } from "@yourtoolshq/ui/button";
import { Card, CardContent } from "@yourtoolshq/ui/card";
import { DateField } from "@yourtoolshq/ui/date-field";
import { Label } from "@yourtoolshq/ui/label";
import { Skeleton } from "@yourtoolshq/ui/skeleton";
import { Textarea } from "@yourtoolshq/ui/textarea";

import type { InvestmentStatementFormState } from "~/components/investment-statements/investment-form-state";
import { InvestmentDetailsBadge } from "~/components/investment-statements/investment-details-badge";
import {
  formStateFromSnapshot,
  toSaveCommand,
} from "~/components/investment-statements/investment-form-state";
import {
  invalidateInvestmentCaches,
  isConflictError,
} from "~/components/investment-statements/investment-invalidation";
import {
  fieldDefinitions,
  reviewStatusLabels,
  sectionCoverageLabels,
} from "~/components/investment-statements/investment-labels";
import { InvestmentPositionsPanel } from "~/components/investment-statements/investment-positions-panel";
import { InvestmentSummaryPanel } from "~/components/investment-statements/investment-summary-panel";
import { ReconciliationAlerts } from "~/components/investment-statements/reconciliation-alerts";
import { RemoveEnrichmentDialog } from "~/components/investment-statements/remove-enrichment-dialog";
import { StatementPdfPreview } from "~/components/investment-statements/statement-pdf-preview";
import { accountTypeLabels } from "~/lib/account-types";
import { formatDateLabel } from "~/lib/format-date";
import { api } from "~/trpc/react";

export function InvestmentStatementWorkspace({
  documentId,
}: {
  documentId: string;
}) {
  const utils = api.useUtils();
  const payload = api.investmentStatements.getByDocument.useQuery({
    documentId,
  });
  const instruments = api.investmentInstruments.list.useQuery();

  const [form, setForm] = useState<InvestmentStatementFormState | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("holdings");
  const [removeOpen, setRemoveOpen] = useState(false);

  const document = payload.data?.document;
  const snapshot = payload.data?.snapshot ?? null;

  useEffect(() => {
    setForm(null);
    setConflictMessage(null);
  }, [documentId]);

  useEffect(() => {
    if (!payload.data || form !== null) return;
    setForm(
      formStateFromSnapshot(
        payload.data.snapshot,
        payload.data.document.documentDate,
      ),
    );
  }, [payload.data, form]);

  const applyServerSnapshot = useCallback(
    (next: Parameters<typeof formStateFromSnapshot>[0]) => {
      setForm(formStateFromSnapshot(next));
      setConflictMessage(null);
    },
    [],
  );

  const reloadLatest = useCallback(async () => {
    const result = await payload.refetch();
    if (!result.data) return;
    setForm(
      formStateFromSnapshot(
        result.data.snapshot,
        result.data.document.documentDate,
      ),
    );
    setConflictMessage(null);
  }, [payload]);

  const instrumentNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of instruments.data ?? []) {
      map.set(
        item.id,
        item.identifiers.length
          ? item.identifiers
              .map(
                (id) =>
                  `${id.value}${id.namespace ? ` / ${id.namespace}` : ""}`,
              )
              .join(", ")
          : item.displayName,
      );
    }
    return map;
  }, [instruments.data]);

  const save = api.investmentStatements.save.useMutation({
    onSuccess: async (next) => {
      await invalidateInvestmentCaches(utils, {
        documentId,
        accountId: next.accountId,
      });
      applyServerSnapshot(next);
      toast.success("Draft saved.");
    },
    onError: (error) => {
      if (isConflictError(error)) {
        setConflictMessage(
          "Someone else saved newer details. Reload to continue or save again with the latest revision.",
        );
      }
      toast.error(error.message);
    },
  });

  const review = api.investmentStatements.review.useMutation({
    onSuccess: async (next) => {
      await invalidateInvestmentCaches(utils, {
        documentId,
        accountId: next.accountId,
      });
      applyServerSnapshot(next);
      toast.success("Facts marked as reviewed.");
    },
    onError: (error) => {
      if (isConflictError(error)) {
        setConflictMessage(
          "Someone else saved newer details. Reload to continue or save again with the latest revision.",
        );
      }
      toast.error(error.message);
    },
  });

  if (payload.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[480px] w-full rounded-xl" />
      </div>
    );
  }

  if (payload.error || !document) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/accounts">
            <ArrowLeft />
            Accounts
          </Link>
        </Button>
        <p className="text-destructive text-sm">
          {payload.error?.message ?? "Statement not found or not eligible."}
        </p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[480px] w-full rounded-xl" />
      </div>
    );
  }

  const preferredCurrency = form.totals[0]?.currency ?? "CAD";
  const pending = save.isPending || review.isPending;
  const canSave = !pending && Boolean(form.valuationDate);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/accounts/${document.accountId}`}>
            <ArrowLeft />
            {document.accountName}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {document.title}
          </h1>
          <p className="text-muted-foreground text-sm">
            {accountTypeLabels[document.accountType]} ·{" "}
            {document.periodKey ?? "Statement"} · Issue date{" "}
            {formatDateLabel(document.documentDate) ?? "—"}
          </p>
          <div className="flex flex-wrap gap-2">
            <InvestmentDetailsBadge snapshot={snapshot} />
            {snapshot ? (
              <Badge variant="outline">
                {reviewStatusLabels[snapshot.reviewStatus]}
              </Badge>
            ) : null}
            {snapshot ? (
              <>
                <Badge variant="secondary">
                  Summary: {sectionCoverageLabels[snapshot.summaryCoverage]}
                </Badge>
                <Badge variant="secondary">
                  Holdings: {sectionCoverageLabels[snapshot.holdingsCoverage]}
                </Badge>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
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
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => setRemoveOpen(true)}
            >
              Remove details
            </Button>
          ) : null}
        </div>
      </div>

      {conflictMessage ? (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
          role="alert"
        >
          <p>{conflictMessage}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => void reloadLatest()}
          >
            Reload latest
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:h-[calc(100dvh-320px)] lg:min-h-[520px] lg:grid-cols-[minmax(280px,.7fr)_minmax(0,1.3fr)]">
        <div className="h-[500px] min-w-0 lg:h-full">
          {document.mimeType === "application/pdf" ? (
            <StatementPdfPreview
              url={filePreviewUrl({
                id: document.fileId,
                mimeType: document.mimeType,
              })}
              title={document.title}
            />
          ) : (
            <div className="bg-muted/20 h-full overflow-auto rounded-lg border p-3">
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
        <div className="flex min-h-0 min-w-0 flex-col rounded-lg border">
          <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
            <Label htmlFor="valuation-date">Valuation date</Label>
            <div className="w-48">
              <DateField
                id="valuation-date"
                value={form.valuationDate}
                onChange={(value) => setForm({ ...form, valuationDate: value })}
                disabled={pending}
              />
            </div>
          </div>
          <div
            className="flex flex-wrap items-center gap-1 border-b p-2"
            aria-label="Statement sections"
          >
            {[
              ["holdings", `Holdings (${form.positions.length})`],
              ["summary", "Summary"],
              ["metadata", "Dates & notes"],
              ["checks", "Checks"],
            ].map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={activeTab === value ? "secondary" : "ghost"}
                aria-pressed={activeTab === value}
                onClick={() => setActiveTab(value!)}
              >
                {label}
              </Button>
            ))}
          </div>
          <fieldset
            className="m-0 min-h-0 min-w-0 flex-1 space-y-4 overflow-auto border-0 p-4"
            disabled={pending}
          >
            <div hidden={activeTab !== "metadata"}>
              <Card className="shadow-none">
                <CardContent className="space-y-4 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="coverage-start">Coverage start</Label>
                      <DateField
                        id="coverage-start"
                        value={form.coverageStart}
                        onChange={(value) =>
                          setForm({ ...form, coverageStart: value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="coverage-end">Coverage end</Label>
                      <DateField
                        id="coverage-end"
                        value={form.coverageEnd}
                        onChange={(value) =>
                          setForm({ ...form, coverageEnd: value })
                        }
                      />
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {fieldDefinitions.coverageDates}
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="statement-notes">Workspace notes</Label>
                    <Textarea
                      id="statement-notes"
                      value={form.notes}
                      onChange={(event) =>
                        setForm({ ...form, notes: event.target.value })
                      }
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div hidden={activeTab !== "summary"}>
              <InvestmentSummaryPanel form={form} onChange={setForm} />
            </div>
            <div hidden={activeTab !== "holdings"}>
              <InvestmentPositionsPanel
                form={form}
                onChange={setForm}
                accountId={document.accountId}
                documentId={document.id}
                instrumentNames={Object.fromEntries(instrumentNames)}
              />
            </div>
            <div hidden={activeTab !== "checks"}>
              <ReconciliationAlerts
                form={form}
                preferredCurrency={preferredCurrency}
              />
            </div>
          </fieldset>
          <div className="bg-background flex flex-wrap items-center justify-between gap-2 border-t p-3">
            <span className="text-muted-foreground text-xs">
              {!form.valuationDate
                ? "Enter the valuation date printed on the statement."
                : "Blank means unreported. Review against the PDF."}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={!canSave}
                onClick={() => save.mutate(toSaveCommand(documentId, form))}
              >
                {save.isPending ? <Loader2 className="animate-spin" /> : null}
                Save draft
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!canSave}
                onClick={() => {
                  save.mutate(toSaveCommand(documentId, form), {
                    onSuccess: (saved) =>
                      review.mutate({
                        documentId,
                        expectedRevision: saved.revision,
                      }),
                  });
                }}
              >
                {review.isPending ? <Loader2 className="animate-spin" /> : null}
                Review
              </Button>
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
          onRemoved={() => {
            setForm(formStateFromSnapshot(null, document.documentDate));
          }}
        />
      ) : null}
    </div>
  );
}
