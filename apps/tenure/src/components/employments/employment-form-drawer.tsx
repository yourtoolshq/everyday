"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  commissionPercentToBasisPoints,
  compensationCurrencies,
  compensationCurrencyLabels,
  compensationTypeLabels,
  compensationTypes,
  type CompensationCurrency,
  type CompensationType,
} from "~/lib/compensation";
import { employmentStatusLabels, employmentStatuses } from "~/lib/employment-status";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";

type EmploymentFormValues = {
  id: string;
  employerId: string;
  personId: string;
  jobTitle: string | null;
  status: (typeof employmentStatuses)[number];
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
};

type EmploymentFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  employment?: EmploymentFormValues;
  defaultEmployerId?: string;
  defaultPersonId?: string;
  onSuccess?: (employmentId: string) => void;
};

export function EmploymentFormDrawer({
  open,
  onOpenChange,
  mode,
  employment,
  defaultEmployerId,
  defaultPersonId,
  onSuccess,
}: EmploymentFormDrawerProps) {
  const utils = api.useUtils();
  const employers = api.employers.list.useQuery();
  const people = api.people.list.useQuery();

  const [employerId, setEmployerId] = useState("");
  const [personId, setPersonId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [status, setStatus] = useState<(typeof employmentStatuses)[number]>("current");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [includeStartingCompensation, setIncludeStartingCompensation] = useState(false);
  const [compensationType, setCompensationType] = useState<CompensationType>("annual_salary");
  const [compensationCurrency, setCompensationCurrency] = useState<CompensationCurrency>("CAD");
  const [compensationAmount, setCompensationAmount] = useState("");
  const [compensationPercent, setCompensationPercent] = useState("");
  const [compensationEffectiveDate, setCompensationEffectiveDate] = useState("");

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && employment) {
      setEmployerId(employment.employerId);
      setPersonId(employment.personId);
      setJobTitle(employment.jobTitle ?? "");
      setStatus(employment.status);
      setStartDate(employment.startDate ?? "");
      setEndDate(employment.endDate ?? "");
      setNotes(employment.notes ?? "");
      return;
    }

    setEmployerId(defaultEmployerId ?? "");
    setPersonId(defaultPersonId ?? "");
    setJobTitle("");
    setStatus("current");
    setStartDate("");
    setEndDate("");
    setNotes("");
    setIncludeStartingCompensation(false);
    setCompensationType("annual_salary");
    setCompensationCurrency("CAD");
    setCompensationAmount("");
    setCompensationPercent("");
    setCompensationEffectiveDate("");
  }, [open, mode, employment, defaultEmployerId, defaultPersonId]);

  const invalidateEmploymentQueries = async (employmentId: string, employerIdValue: string) => {
    await Promise.all([
      utils.employments.list.invalidate(),
      utils.employments.getById.invalidate({ id: employmentId }),
      utils.employers.getById.invalidate({ id: employerIdValue }),
    ]);
  };

  const createCompensationChange = api.compensationChanges.create.useMutation();
  const createEmployment = api.employments.create.useMutation();

  const updateEmployment = api.employments.update.useMutation({
    onSuccess: async (updated) => {
      await invalidateEmploymentQueries(updated.id, updated.employerId);
      toast.success("Employment updated.");
      onOpenChange(false);
      onSuccess?.(updated.id);
    },
    onError: (error) => toast.error(error.message),
  });

  const isPending =
    createEmployment.isPending || updateEmployment.isPending || createCompensationChange.isPending;

  function buildStartingCompensation() {
    if (!includeStartingCompensation) return null;

    const effectiveDate = compensationEffectiveDate || startDate;
    if (!effectiveDate) {
      toast.error("Enter a start date or compensation effective date.");
      return undefined;
    }

    const amountCents =
      compensationType === "commission"
        ? null
        : (() => {
            const normalized = compensationAmount.trim().replaceAll(",", "");
            if (normalized === "") return null;
            const amount = Number(normalized);
            if (!Number.isFinite(amount) || amount < 0) return null;
            return Math.round(amount * 100);
          })();
    const commissionBasisPoints =
      compensationType === "commission"
        ? commissionPercentToBasisPoints(compensationPercent)
        : null;

    if (compensationType === "commission" && commissionBasisPoints === null) {
      toast.error("Enter a valid commission percentage.");
      return undefined;
    }
    if (compensationType !== "commission" && amountCents === null) {
      toast.error("Enter a valid starting compensation amount.");
      return undefined;
    }

    return {
      type: compensationType,
      currency: compensationCurrency,
      effectiveDate,
      amountCents,
      commissionBasisPoints,
    };
  }

  async function submitEmployment() {
    if (!employerId || !personId) {
      toast.error("Choose an employer and person.");
      return;
    }

    const payload = {
      employerId,
      personId,
      jobTitle: jobTitle.trim() || null,
      status,
      startDate: startDate || null,
      endDate: endDate || null,
      notes: notes.trim() || null,
    };

    if (mode === "create") {
      const startingCompensation = buildStartingCompensation();
      if (startingCompensation === undefined) return;

      try {
        const created = await createEmployment.mutateAsync(payload);
        if (startingCompensation) {
          await createCompensationChange.mutateAsync({
            employmentId: created.id,
            ...startingCompensation,
          });
        }
        await invalidateEmploymentQueries(created.id, created.employerId);
        await utils.compensationChanges.getCurrentByEmployment.invalidate({
          employmentId: created.id,
        });
        toast.success("Employment added.");
        onOpenChange(false);
        onSuccess?.(created.id);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not add employment.");
      }
      return;
    }
    if (!employment) return;
    updateEmployment.mutate({ id: employment.id, ...payload });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{mode === "create" ? "Add employment" : "Edit employment"}</SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Record an employment period for someone in your household."
              : "Update this employment period's details."}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col gap-4 px-4 pb-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitEmployment();
          }}
        >
          <div className="space-y-2">
            <Label>Employer</Label>
            <Select
              value={employerId}
              onValueChange={setEmployerId}
              disabled={Boolean(defaultEmployerId && mode === "create")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose employer" />
              </SelectTrigger>
              <SelectContent>
                {employers.data?.map((employer) => (
                  <SelectItem key={employer.id} value={employer.id}>
                    {employer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Person</Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose person" />
              </SelectTrigger>
              <SelectContent>
                {people.data?.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="employment-job-title">Job title</Label>
            <Input
              id="employment-job-title"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              placeholder="Software engineer"
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as typeof status)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {employmentStatuses.map((item) => (
                  <SelectItem key={item} value={item}>
                    {employmentStatusLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="employment-start-date">Start date</Label>
              <Input
                id="employment-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employment-end-date">End date</Label>
              <Input
                id="employment-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="employment-notes">Notes</Label>
            <Textarea
              id="employment-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
            />
          </div>

          {mode === "create" ? (
            <div className="space-y-4 rounded-lg border p-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={includeStartingCompensation}
                  onChange={(event) => setIncludeStartingCompensation(event.target.checked)}
                />
                Record starting compensation
              </label>

              {includeStartingCompensation ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={compensationType}
                        onValueChange={(value) =>
                          setCompensationType(value as CompensationType)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {compensationTypes.map((item) => (
                            <SelectItem key={item} value={item}>
                              {compensationTypeLabels[item]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select
                        value={compensationCurrency}
                        onValueChange={(value) =>
                          setCompensationCurrency(value as CompensationCurrency)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {compensationCurrencies.map((item) => (
                            <SelectItem key={item} value={item}>
                              {compensationCurrencyLabels[item]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="starting-compensation-effective-date">Effective date</Label>
                    <Input
                      id="starting-compensation-effective-date"
                      type="date"
                      value={compensationEffectiveDate}
                      onChange={(event) => setCompensationEffectiveDate(event.target.value)}
                      placeholder={startDate ? `Defaults to ${startDate}` : undefined}
                    />
                  </div>

                  {compensationType === "commission" ? (
                    <div className="space-y-2">
                      <Label htmlFor="starting-compensation-percent">Commission percentage</Label>
                      <Input
                        id="starting-compensation-percent"
                        inputMode="decimal"
                        value={compensationPercent}
                        onChange={(event) => setCompensationPercent(event.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="starting-compensation-amount">
                        {compensationType === "annual_salary" ? "Annual salary" : "Hourly rate"}
                      </Label>
                      <Input
                        id="starting-compensation-amount"
                        inputMode="decimal"
                        value={compensationAmount}
                        onChange={(event) => setCompensationAmount(event.target.value)}
                      />
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <SheetFooter className="px-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {mode === "create" ? "Add employment" : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
