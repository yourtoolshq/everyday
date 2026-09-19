"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CompensationChangeFormSheet } from "~/components/compensation/compensation-change-form-sheet";
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
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  compensationTypeLabels,
  formatCompensationRate,
  getCompensationDeltaDisplay,
} from "~/lib/compensation";
import { cn } from "cn";
import { formatDateLabel } from "~/lib/documents";
import { api, type RouterOutputs } from "~/trpc/react";

type CompensationChange = RouterOutputs["compensationChanges"]["listByEmployment"][number];

type EmploymentCompensationPanelProps = {
  employmentId: string;
  startDate?: string | null;
};

export function EmploymentCompensationPanel({
  employmentId,
  startDate,
}: EmploymentCompensationPanelProps) {
  const utils = api.useUtils();
  const changes = api.compensationChanges.listByEmployment.useQuery({ employmentId });
  const [formOpen, setFormOpen] = useState(false);
  const [editingChange, setEditingChange] = useState<CompensationChange | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompensationChange | null>(null);

  const deleteChange = api.compensationChanges.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.compensationChanges.listByEmployment.invalidate({ employmentId }),
        utils.compensationChanges.getCurrentByEmployment.invalidate({ employmentId }),
        utils.employments.list.invalidate(),
        utils.employmentRecords.completenessByEmployment.invalidate({ employmentId }),
        utils.employmentRecords.listForReview.invalidate(),
      ]);
      toast.success("Compensation change removed.");
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
          <CardTitle className="text-base">Compensation</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setEditingChange(null);
              setFormOpen(true);
            }}
          >
            <Plus />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          {changes.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No compensation changes yet. Record salary, hourly, or commission updates as they are
              agreed.
            </p>
          ) : (
            <ul className="divide-y">
              {changes.data?.map((change) => {
                const delta = getCompensationDeltaDisplay(change);
                const isFuture = change.effectiveDate > new Date().toISOString().slice(0, 10);

                return (
                  <li
                    key={change.id}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{formatCompensationRate(change)}</p>
                        <Badge variant="secondary">{compensationTypeLabels[change.type]}</Badge>
                        {delta ? (
                          <Badge
                            className={cn(
                              "border font-semibold",
                              delta.direction === "increase"
                                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                : "border-red-500/30 bg-red-500/15 text-red-800 dark:text-red-300",
                            )}
                          >
                            {delta.label}
                          </Badge>
                        ) : null}
                        {isFuture ? <Badge variant="outline">Future</Badge> : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Effective {formatDateLabel(change.effectiveDate) ?? change.effectiveDate}
                      </p>
                      {change.notes ? (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {change.notes}
                        </p>
                      ) : null}
                      {change.documentTitle ? (
                        <p className="text-xs text-muted-foreground">
                          Document: {change.documentTitle}
                        </p>
                      ) : null}
                      {change.discussionTitle ? (
                        <p className="text-xs text-muted-foreground">
                          Discussion: {change.discussionTitle}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit compensation change"
                        onClick={() => {
                          setEditingChange(change);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove compensation change"
                        onClick={() => setDeleteTarget(change)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <CompensationChangeFormSheet
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingChange(null);
        }}
        employmentId={employmentId}
        mode={editingChange ? "edit" : "create"}
        change={editingChange}
        defaultEffectiveDate={startDate}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove compensation change?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the agreed rate record. Linked documents and discussions stay in place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteChange.mutate({ id: deleteTarget.id });
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
