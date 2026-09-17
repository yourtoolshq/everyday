"use client";

import {
  IconDownload,
  IconExternalLink,
  IconFileDescription,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import {
  assessmentKindLabels,
  filingKindLabels,
  filingStatusLabels,
  returnCopyStatusLabels,
  taxYearStatusLabels,
  type FilingKind,
  type TaxYearLifecycleWarning,
  type TaxYearStatus,
} from "~/domain/filing";
import { formatSignedCad } from "~/domain/money";
import { skipToken } from "@tanstack/react-query";
import { api, type RouterOutputs } from "~/trpc/react";
import { AdjustmentSheet } from "./adjustment-sheet";
import { AssessmentSheet } from "./assessment-sheet";
import { CraReferenceSection } from "./cra-reference-section";
import { OriginalReturnSheet } from "./original-return-sheet";

type Filing = RouterOutputs["filing"]["timeline"]["filings"][number];
type Person = RouterOutputs["settings"]["get"]["people"][number];

function assessmentActionLabel(kind: FilingKind, editing: boolean) {
  if (kind === "adjustment") {
    return editing ? "Edit NOR" : "Add NOR";
  }
  return editing ? "Edit NOA" : "Add NOA";
}

function attachmentActionLabel(kind: FilingKind) {
  return kind === "adjustment" ? "View adjustment" : "View T1";
}

function TimelineEntryCard({
  filing,
  onEdit,
  onAddAssessment,
  onDelete,
}: {
  filing: Filing;
  onEdit: () => void;
  onAddAssessment: () => void;
  onDelete: () => void;
}) {
  const isAdjustment = filing.kind === "adjustment";
  const documentLabel = isAdjustment ? "Submitted adjustment" : "Submitted T1";

  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {filingKindLabels[filing.kind]}
            </CardTitle>
            <CardDescription>
              {filing.submissionDate ??
                (isAdjustment ? "Submission date unknown" : "Filing date unknown")}
            </CardDescription>
          </div>
          <Badge variant="outline">{filingStatusLabels[filing.status]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isAdjustment && filing.reason ? (
          <div>
            <p className="text-muted-foreground">Reason</p>
            <p className="font-medium">{filing.reason}</p>
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">{documentLabel}</p>
            <p className="font-medium">
              {returnCopyStatusLabels[filing.returnCopyStatus]}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">
              {isAdjustment ? "Expected change" : "Expected result"}
            </p>
            <p className="font-medium tabular-nums">
              {formatSignedCad(
                isAdjustment ? filing.expectedChangeCents : filing.expectedResultCents,
              )}
            </p>
          </div>
        </div>
        {isAdjustment && filing.affectedTaxItems.length > 0 ? (
          <div>
            <p className="text-muted-foreground">Affected tax items</p>
            <p className="font-medium">
              {filing.affectedTaxItems.map((item) => item.name).join(", ")}
            </p>
          </div>
        ) : null}
        {filing.notes ? (
          <p className="text-muted-foreground">{filing.notes}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {filing.attachmentFileName ? (
            <>
              <Button asChild size="sm" variant="outline">
                <a
                  href={`/api/filings/${filing.id}/attachment`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {attachmentActionLabel(filing.kind)} <IconExternalLink />
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={`/api/filings/${filing.id}/attachment?download=1`}>
                  Download <IconDownload />
                </a>
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="outline" onClick={onEdit}>
            Edit <IconPencil />
          </Button>
          {!filing.assessmentId ? (
            <Button size="sm" onClick={onAddAssessment}>
              {assessmentActionLabel(filing.kind, false)} <IconPlus />
            </Button>
          ) : null}
          {!filing.assessmentId ? (
            <Button size="sm" variant="outline" onClick={onDelete}>
              Delete <IconTrash />
            </Button>
          ) : null}
        </div>
        {filing.assessmentId ? (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">
                {filing.assessmentKind
                  ? assessmentKindLabels[filing.assessmentKind]
                  : "Assessment"}
              </p>
              <p className="text-muted-foreground">{filing.assessmentDate}</p>
            </div>
            <p className="font-medium tabular-nums">
              {formatSignedCad(filing.assessedResultCents)}
            </p>
            {filing.assessmentNotes ? (
              <p className="text-muted-foreground">{filing.assessmentNotes}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {filing.assessmentAttachmentFileName ? (
                <>
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={`/api/assessments/${filing.assessmentId}/attachment`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View document <IconExternalLink />
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={`/api/assessments/${filing.assessmentId}/attachment?download=1`}
                    >
                      Download <IconDownload />
                    </a>
                  </Button>
                </>
              ) : null}
              <Button size="sm" variant="outline" onClick={onAddAssessment}>
                {assessmentActionLabel(filing.kind, true)} <IconPencil />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PersonSection({
  person,
  filings,
  onAddReturn,
  onAddAdjustment,
  onEdit,
  onAssessment,
  onDelete,
}: {
  person: Person;
  filings: Filing[];
  onAddReturn: () => void;
  onAddAdjustment: () => void;
  onEdit: (filing: Filing) => void;
  onAssessment: (filing: Filing) => void;
  onDelete: (filing: Filing) => void;
}) {
  const originalReturn = filings.find((filing) => filing.kind === "original_return");

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{person.name}</h3>
        <div className="flex flex-wrap gap-2">
          {!originalReturn ? (
            <Button size="sm" onClick={onAddReturn}>
              Add return <IconPlus />
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onAddAdjustment}>
              Add adjustment <IconPlus />
            </Button>
          )}
        </div>
      </div>
      {filings.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
            <IconFileDescription />
            No filing recorded for this person in this year.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filings.map((filing) => (
            <TimelineEntryCard
              key={filing.id}
              filing={filing}
              onEdit={() => onEdit(filing)}
              onAddAssessment={() => onAssessment(filing)}
              onDelete={() => onDelete(filing)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function TaxFiling() {
  const settings = api.settings.get.useQuery();
  const activeYear = settings.data?.years.find((year) => year.isActive);
  const taxYearId = activeYear?.id;

  const timeline = api.filing.timeline.useQuery(
    taxYearId ? { taxYearId } : skipToken,
  );
  const utils = api.useUtils();
  const updateStatus = api.taxYear.updateStatus.useMutation({
    onError: (error) => toast.error(error.message),
  });
  const [pendingStatus, setPendingStatus] = useState<TaxYearStatus | null>(null);
  const [lifecycleWarnings, setLifecycleWarnings] = useState<TaxYearLifecycleWarning[]>([]);

  async function applyStatusChange(
    status: TaxYearStatus,
    acknowledgeWarnings: boolean,
  ) {
    if (!activeYear) return;
    const result = await updateStatus.mutateAsync({
      id: activeYear.id,
      status,
      acknowledgeWarnings,
    });
    if (result.requiresConfirmation) {
      setPendingStatus(status);
      setLifecycleWarnings(result.warnings);
      return;
    }
    setPendingStatus(null);
    setLifecycleWarnings([]);
    if (result.warnings.length > 0) {
      toast.message("Tax year updated with warnings acknowledged", {
        description: result.warnings.map((warning) => warning.message).join(" "),
      });
    } else {
      toast.success("Tax year status updated.");
    }
    await utils.invalidate();
  }

  const [addingReturnForPersonId, setAddingReturnForPersonId] = useState<
    number | undefined
  >();
  const [addingAdjustmentForPersonId, setAddingAdjustmentForPersonId] = useState<
    number | undefined
  >();
  const [editingReturn, setEditingReturn] = useState<Filing | null>(null);
  const [editingAdjustment, setEditingAdjustment] = useState<Filing | null>(null);
  const [assessmentFiling, setAssessmentFiling] = useState<Filing | null>(null);
  const [deletingFiling, setDeletingFiling] = useState<Filing | null>(null);
  const [deletingPending, setDeletingPending] = useState(false);

  const filingsByPerson = useMemo(() => {
    const map = new Map<number, Filing[]>();
    for (const filing of timeline.data?.filings ?? []) {
      const current = map.get(filing.personId) ?? [];
      current.push(filing);
      map.set(filing.personId, current);
    }
    return map;
  }, [timeline.data?.filings]);

  async function refresh() {
    await Promise.all([
      utils.filing.timeline.invalidate(),
      utils.settings.get.invalidate(),
    ]);
  }

  async function removeFiling() {
    if (!deletingFiling) return;
    setDeletingPending(true);
    try {
      const endpoint =
        deletingFiling.kind === "adjustment"
          ? `/api/adjustments/${deletingFiling.id}`
          : `/api/filings/${deletingFiling.id}`;
      const response = await fetch(endpoint, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to delete the filing record.");
      }
      setDeletingFiling(null);
      await refresh();
      toast.success(
        deletingFiling.kind === "adjustment"
          ? "Adjustment deleted."
          : "Original return deleted.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete the filing record.",
      );
    } finally {
      setDeletingPending(false);
    }
  }

  if (settings.isLoading || timeline.isLoading) {
    return (
      <div className="space-y-5 p-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const error = settings.error ?? timeline.error;
  if (error || !settings.data || !timeline.data || !taxYearId || !activeYear) {
    return (
      <div className="p-6 text-sm text-destructive">
        Unable to load tax filing. {error?.message}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{activeYear.year} tax year</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Tax Filing</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Record what was filed, what changed through adjustments, and what CRA assessed for this year.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Lifecycle</p>
          <Select
            value={activeYear.status ?? "tracking"}
            onValueChange={(value) => {
              void applyStatusChange(value as TaxYearStatus, false);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(taxYearStatusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-8">
        {timeline.data.people.map((person) => (
          <PersonSection
            key={person.id}
            person={person}
            filings={filingsByPerson.get(person.id) ?? []}
            onAddReturn={() => setAddingReturnForPersonId(person.id)}
            onAddAdjustment={() => setAddingAdjustmentForPersonId(person.id)}
            onEdit={(filing) => {
              if (filing.kind === "adjustment") setEditingAdjustment(filing);
              else setEditingReturn(filing);
            }}
            onAssessment={(filing) => setAssessmentFiling(filing)}
            onDelete={(filing) => setDeletingFiling(filing)}
          />
        ))}
        <CraReferenceSection taxYearId={taxYearId} people={timeline.data.people} />
      </div>

      <OriginalReturnSheet
        key={
          editingReturn
            ? `edit-${editingReturn.id}`
            : addingReturnForPersonId !== undefined
              ? `add-${addingReturnForPersonId}`
              : "closed"
        }
        taxYearId={taxYearId}
        people={timeline.data.people}
        filing={editingReturn}
        defaultPersonId={addingReturnForPersonId}
        open={addingReturnForPersonId !== undefined || editingReturn !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAddingReturnForPersonId(undefined);
            setEditingReturn(null);
          }
        }}
        onSaved={refresh}
      />

      <AdjustmentSheet
        key={
          editingAdjustment
            ? `edit-${editingAdjustment.id}`
            : addingAdjustmentForPersonId !== undefined
              ? `add-${addingAdjustmentForPersonId}`
              : "closed"
        }
        taxYearId={taxYearId}
        people={timeline.data.people}
        filing={editingAdjustment}
        defaultPersonId={addingAdjustmentForPersonId}
        open={addingAdjustmentForPersonId !== undefined || editingAdjustment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAddingAdjustmentForPersonId(undefined);
            setEditingAdjustment(null);
          }
        }}
        onSaved={refresh}
      />

      {assessmentFiling ? (
        <AssessmentSheet
          key={`${assessmentFiling.id}-${assessmentFiling.assessmentId ?? "new"}`}
          filing={assessmentFiling}
          open={assessmentFiling !== null}
          onOpenChange={(open) => {
            if (!open) setAssessmentFiling(null);
          }}
          onSaved={refresh}
        />
      ) : null}

      <AlertDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingStatus(null);
            setLifecycleWarnings([]);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Change lifecycle to {pendingStatus ? taxYearStatusLabels[pendingStatus] : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Tax Book found issues that may mean this year is not ready yet:</p>
                <ul className="list-disc space-y-1 pl-5">
                  {lifecycleWarnings.map((warning) => (
                    <li key={warning.code}>{warning.message}</li>
                  ))}
                </ul>
                <p>You can continue anyway if the history is intentionally incomplete.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateStatus.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={updateStatus.isPending || pendingStatus === null}
              onClick={() => {
                if (pendingStatus) {
                  void applyStatusChange(pendingStatus, true);
                }
              }}
            >
              {updateStatus.isPending ? "Updating…" : "Continue anyway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deletingFiling !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingFiling(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deletingFiling?.kind === "adjustment" ? "adjustment" : "original return"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the {deletingFiling?.kind === "adjustment" ? "adjustment" : "original return"} for {deletingFiling?.personName}. Remove the related assessment first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deletingPending} onClick={removeFiling}>
              {deletingPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
