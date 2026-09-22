"use client";

import { ExternalLink, Pencil, Paperclip, Plus } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { formatDateLabel } from "~/lib/documents";
import { formatCad } from "~/lib/money";
import { payStubCompletenessLabels } from "~/lib/pay-stub-completeness";
import type { RouterOutputs } from "~/trpc/react";

type PeriodRow = RouterOutputs["paychecks"]["periodCompleteness"]["periods"][number];
type Paycheck = RouterOutputs["paychecks"]["listByEmployment"][number];

type PayPeriodDetailSheetProps = {
  period: PeriodRow | null;
  paychecks: Paycheck[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddPaycheck: (periodKey: string) => void;
  onEditPaycheck: (paycheckId: string) => void;
  onAttachStub: (paycheckId: string) => void;
  onMarkNotApplicable?: (periodKey: string) => void;
  onUndoNotApplicable?: (periodKey: string) => void;
};

export function PayPeriodDetailSheet({
  period,
  paychecks,
  open,
  onOpenChange,
  onAddPaycheck,
  onEditPaycheck,
  onAttachStub,
  onMarkNotApplicable,
  onUndoNotApplicable,
}: PayPeriodDetailSheetProps) {
  const periodPaychecks = period
    ? paychecks
        .filter((paycheck) => period.paychecks.some((item) => item.id === paycheck.id))
        .sort((left, right) => right.payDate.localeCompare(left.payDate))
    : [];

  if (!period) return null;

  const completeness = period.completeness;
  const canAddPaycheck =
    completeness === "missing_paycheck" ||
    completeness === "waiting" ||
    completeness === "complete" ||
    completeness === "missing_stub";
  const canMarkNotApplicable = completeness === "missing_paycheck" && Boolean(onMarkNotApplicable);
  const canUndoNotApplicable = completeness === "not_applicable" && Boolean(onUndoNotApplicable);

  function runAction(action: () => void) {
    action();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{period.label}</DialogTitle>
          <DialogDescription>
            {payStubCompletenessLabels[completeness]}
            {period.paycheckCount > 0
              ? ` · ${period.paycheckCount} paycheck${period.paycheckCount === 1 ? "" : "s"}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {periodPaychecks.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {periodPaychecks.map((paycheck) => (
              <li key={paycheck.id} className="space-y-2 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">
                    {formatDateLabel(paycheck.payDate) ?? paycheck.payDate}
                  </p>
                  {paycheck.documentId ? (
                    <Badge variant="secondary">Stub attached</Badge>
                  ) : (
                    <Badge variant="destructive">Missing stub</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Gross {formatCad(paycheck.grossPayCents)} · Net {formatCad(paycheck.netPayCents)}
                </p>
                {paycheck.documentTitle ? (
                  <p className="truncate text-xs text-muted-foreground">{paycheck.documentTitle}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {paycheck.documentId ? (
                    <Button type="button" size="sm" variant="outline" asChild>
                      <a href={`/api/documents/${paycheck.documentId}/file`} target="_blank">
                        <ExternalLink />
                        View stub
                      </a>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => runAction(() => onAttachStub(paycheck.id))}
                    >
                      <Paperclip />
                      Attach stub
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => runAction(() => onEditPaycheck(paycheck.id))}
                  >
                    <Pencil />
                    Edit
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No paychecks recorded for this period yet.
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {canMarkNotApplicable ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => runAction(() => onMarkNotApplicable?.(period.key))}
              >
                Not applicable
              </Button>
            ) : null}
            {canUndoNotApplicable ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => runAction(() => onUndoNotApplicable?.(period.key))}
              >
                Undo not applicable
              </Button>
            ) : null}
          </div>
          {canAddPaycheck ? (
            <Button
              type="button"
              onClick={() => runAction(() => onAddPaycheck(period.key))}
            >
              <Plus />
              Add paycheck
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
