"use client";

import { useMemo, useState } from "react";
import { Plus, Settings2, Upload } from "lucide-react";
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
} from "@yourtoolshq/ui/alert-dialog";
import { Button } from "@yourtoolshq/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@yourtoolshq/ui/card";

import type { PayFrequency } from "~/lib/pay-frequency";
import type { DeductionSettings } from "~/lib/paycheck-deductions";
import type { RouterOutputs } from "~/trpc/react";
import { EmploymentPayPeriods } from "~/components/paychecks/employment-pay-periods";
import { EmploymentPaySettingsSheet } from "~/components/paychecks/employment-pay-settings-sheet";
import { PayStubUploadSheet } from "~/components/paychecks/pay-stub-upload-sheet";
import { PaycheckFormSheet } from "~/components/paychecks/paycheck-form-sheet";
import { PaycheckImportSheet } from "~/components/paychecks/paycheck-import-sheet";
import { payFrequencyLabels } from "~/lib/pay-frequency";
import { api } from "~/trpc/react";

type Paycheck = RouterOutputs["paychecks"]["listByEmployment"][number];

type EmploymentPaychecksPanelProps = {
  employmentId: string;
  employerName: string;
  personName: string;
  payFrequency: PayFrequency;
  biweeklyAnchorDate: string | null;
  deductionSettings: DeductionSettings;
  startDate: string | null;
  endDate: string | null;
  status: "current" | "former";
};

export function EmploymentPaychecksPanel({
  employmentId,
  employerName,
  personName,
  payFrequency,
  biweeklyAnchorDate,
  deductionSettings,
  startDate,
  endDate,
  status,
}: EmploymentPaychecksPanelProps) {
  const utils = api.useUtils();
  const paychecks = api.paychecks.listByEmployment.useQuery({ employmentId });
  const review = api.paychecks.listForReview.useQuery();

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stubOpen, setStubOpen] = useState(false);
  const [editingPaycheck, setEditingPaycheck] = useState<Paycheck | null>(null);
  const [stubPaycheck, setStubPaycheck] = useState<Paycheck | null>(null);
  const [defaultPeriodKey, setDefaultPeriodKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Paycheck | null>(null);

  const sortedPaychecks = useMemo(
    () =>
      [...(paychecks.data ?? [])].sort((left, right) =>
        right.payDate.localeCompare(left.payDate),
      ),
    [paychecks.data],
  );

  const employmentMissing = useMemo(
    () =>
      (review.data?.missing ?? []).filter(
        (item) => item.employmentId === employmentId,
      ).length,
    [review.data?.missing, employmentId],
  );

  const deletePaycheck = api.paychecks.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.paychecks.listByEmployment.invalidate({ employmentId }),
        utils.paychecks.periodCompleteness.invalidate({ employmentId }),
        utils.paychecks.listForReview.invalidate(),
        utils.overview.paySummary.invalidate(),
        utils.employmentRecords.paySummaryByEmployment.invalidate({
          employmentId,
        }),
      ]);
      toast.success("Paycheck deleted.");
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(error.message),
  });

  function openCreate(periodKey?: string) {
    setEditingPaycheck(null);
    setDefaultPeriodKey(periodKey ?? null);
    setFormOpen(true);
  }

  function openEdit(paycheck: Paycheck) {
    setEditingPaycheck(paycheck);
    setDefaultPeriodKey(null);
    setFormOpen(true);
  }

  function openStubUpload(paycheck: Paycheck) {
    setStubPaycheck(paycheck);
    setStubOpen(true);
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base">Paychecks</CardTitle>
          <p className="text-muted-foreground text-xs">
            {payFrequencyLabels[payFrequency]}
            {employmentMissing > 0
              ? ` · ${employmentMissing} item(s) need attention`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 />
            Pay settings
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setImportOpen(true)}
          >
            <Upload />
            Import CSV
          </Button>
          <Button size="sm" onClick={() => openCreate()}>
            <Plus />
            Add paycheck
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <EmploymentPayPeriods
          employmentId={employmentId}
          payFrequency={payFrequency}
          startDate={startDate}
          endDate={endDate}
          status={status}
          paychecks={sortedPaychecks}
          onAddPaycheck={(periodKey) => openCreate(periodKey)}
          onEditPaycheck={(paycheckId) => {
            const paycheck = sortedPaychecks.find(
              (item) => item.id === paycheckId,
            );
            if (paycheck) openEdit(paycheck);
          }}
          onAttachStub={(paycheckId) => {
            const paycheck = sortedPaychecks.find(
              (item) => item.id === paycheckId,
            );
            if (paycheck) openStubUpload(paycheck);
          }}
          onDeletePaycheck={(paycheckId) => {
            const paycheck = sortedPaychecks.find(
              (item) => item.id === paycheckId,
            );
            if (paycheck) setDeleteTarget(paycheck);
          }}
        />
      </CardContent>

      <PaycheckFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        employmentId={employmentId}
        employerName={employerName}
        personName={personName}
        payFrequency={payFrequency}
        biweeklyAnchorDate={biweeklyAnchorDate}
        startDate={startDate}
        endDate={endDate}
        status={status}
        deductionSettings={deductionSettings}
        existingPaychecks={sortedPaychecks}
        paycheck={editingPaycheck}
        defaultPeriodKey={defaultPeriodKey ?? undefined}
      />

      <EmploymentPaySettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        employmentId={employmentId}
        payFrequency={payFrequency}
        biweeklyAnchorDate={biweeklyAnchorDate}
        deductionSettings={deductionSettings}
      />

      <PayStubUploadSheet
        open={stubOpen}
        onOpenChange={setStubOpen}
        paycheckId={stubPaycheck?.id ?? null}
        employmentId={employmentId}
        employerName={employerName}
        personName={personName}
        paycheck={stubPaycheck}
      />

      <PaycheckImportSheet
        employmentId={employmentId}
        open={importOpen}
        onOpenChange={setImportOpen}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete paycheck?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the paycheck entry. Any attached pay stub document
              will remain in documents unless you delete it separately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deletePaycheck.mutate({ id: deleteTarget.id })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
