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
  filingStatusLabels,
  returnCopyStatusLabels,
  taxYearStatusLabels,
  type TaxYearStatus,
} from "~/domain/filing";
import { formatSignedCad } from "~/domain/money";
import { skipToken } from "@tanstack/react-query";
import { api, type RouterOutputs } from "~/trpc/react";
import { AssessmentSheet } from "./assessment-sheet";
import { OriginalReturnSheet } from "./original-return-sheet";

type Filing = RouterOutputs["filing"]["timeline"]["filings"][number];
type Person = RouterOutputs["settings"]["get"]["people"][number];

function FilingCard({
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
  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Original return</CardTitle>
            <CardDescription>
              {filing.submissionDate ?? "Filing date unknown"}
            </CardDescription>
          </div>
          <Badge variant="outline">{filingStatusLabels[filing.status]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Submitted T1</p>
            <p className="font-medium">
              {returnCopyStatusLabels[filing.returnCopyStatus]}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Expected result</p>
            <p className="font-medium tabular-nums">
              {formatSignedCad(filing.expectedResultCents)}
            </p>
          </div>
        </div>
        {filing.notes ? (
          <p className="text-muted-foreground">{filing.notes}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {filing.attachmentFileName ? (
            <>
              <Button asChild size="sm" variant="outline">
                <a href={`/api/filings/${filing.id}/attachment`} target="_blank" rel="noreferrer">
                  View T1 <IconExternalLink />
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
              Add NOA <IconPlus />
            </Button>
          ) : null}
          {!filing.assessmentId ? (
            <Button size="sm" variant="outline" onClick={onDelete}>
              Delete <IconTrash />
            </Button>
          ) : null}
        </div>
        {filing.assessmentId ? (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">
                {filing.assessmentKind
                  ? assessmentKindLabels[filing.assessmentKind]
                  : "Assessment"}
              </p>
              <p className="text-muted-foreground">{filing.assessmentDate}</p>
            </div>
            <p className="tabular-nums font-medium">
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
                      View NOA <IconExternalLink />
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/assessments/${filing.assessmentId}/attachment?download=1`}>
                      Download <IconDownload />
                    </a>
                  </Button>
                </>
              ) : null}
              <Button size="sm" variant="outline" onClick={onAddAssessment}>
                Edit NOA <IconPencil />
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
  filing,
  onAdd,
  onEdit,
  onAssessment,
  onDelete,
}: {
  person: Person;
  filing: Filing | undefined;
  onAdd: () => void;
  onEdit: () => void;
  onAssessment: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{person.name}</h3>
        {!filing ? (
          <Button size="sm" onClick={onAdd}>
            Add return <IconPlus />
          </Button>
        ) : null}
      </div>
      {filing ? (
        <FilingCard
          filing={filing}
          onEdit={onEdit}
          onAddAssessment={onAssessment}
          onDelete={onDelete}
        />
      ) : (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
            <IconFileDescription />
            No filing recorded for this person in this year.
          </CardContent>
        </Card>
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
    onSuccess: async (result) => {
      if (result.warnings.length > 0) {
        toast.message("Tax year updated with warnings", {
          description: result.warnings.map((warning) => warning.message).join(" "),
        });
      } else {
        toast.success("Tax year status updated.");
      }
      await utils.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const [addingForPersonId, setAddingForPersonId] = useState<number | undefined>();
  const [editingFiling, setEditingFiling] = useState<Filing | null>(null);
  const [assessmentFiling, setAssessmentFiling] = useState<Filing | null>(null);
  const [deletingFiling, setDeletingFiling] = useState<Filing | null>(null);
  const [deletingPending, setDeletingPending] = useState(false);

  const filingsByPerson = useMemo(() => {
    const map = new Map<number, Filing>();
    for (const filing of timeline.data?.filings ?? []) {
      if (filing.kind === "original_return") map.set(filing.personId, filing);
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
      const response = await fetch(`/api/filings/${deletingFiling.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to delete the filing.");
      }
      setDeletingFiling(null);
      await refresh();
      toast.success("Original return deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete the filing.",
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
            Record what was filed, what CRA assessed, and the documents worth keeping for this year.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Lifecycle</p>
          <Select
            value={activeYear.status ?? "tracking"}
            onValueChange={(value) =>
              updateStatus.mutate({
                id: activeYear.id,
                status: value as TaxYearStatus,
              })
            }
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
            filing={filingsByPerson.get(person.id)}
            onAdd={() => setAddingForPersonId(person.id)}
            onEdit={() => {
              const filing = filingsByPerson.get(person.id);
              if (filing) setEditingFiling(filing);
            }}
            onAssessment={() => {
              const filing = filingsByPerson.get(person.id);
              if (filing) setAssessmentFiling(filing);
            }}
            onDelete={() => {
              const filing = filingsByPerson.get(person.id);
              if (filing) setDeletingFiling(filing);
            }}
          />
        ))}
      </div>

      <OriginalReturnSheet
        taxYearId={taxYearId}
        people={timeline.data.people}
        filing={editingFiling}
        defaultPersonId={addingForPersonId}
        open={addingForPersonId !== undefined || editingFiling !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAddingForPersonId(undefined);
            setEditingFiling(null);
          }
        }}
        onSaved={refresh}
      />

      {assessmentFiling ? (
        <AssessmentSheet
          filing={assessmentFiling}
          open={assessmentFiling !== null}
          onOpenChange={(open) => {
            if (!open) setAssessmentFiling(null);
          }}
          onSaved={refresh}
        />
      ) : null}

      <AlertDialog
        open={deletingFiling !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingFiling(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete original return?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the filing record for {deletingFiling?.personName}. Assessments must be removed first.
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
