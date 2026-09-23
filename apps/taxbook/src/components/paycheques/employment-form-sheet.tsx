"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { toast } from "sonner";

import type {
  DeductionAmountField,
  DeductionEnabledField,
  EmploymentStatus,
  PayFrequency,
} from "~/domain/employment";
import type { RouterOutputs } from "~/trpc/react";
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
import {
  deductionFields,
  employmentStatuses,
  employmentStatusLabels,
  isIncomeTaxSplit,
  orderedDeductionFields,
  payFrequencies,
  payFrequencyLabels,
} from "~/domain/employment";
import { centsToDollars, dollarsToCents } from "~/domain/money";
import { api } from "~/trpc/react";

type Employment = RouterOutputs["employment"]["list"]["items"][number];
type Person = RouterOutputs["settings"]["get"]["people"][number];

export function EmploymentFormSheet({
  employment,
  people,
  initialPersonId,
  year,
  open,
  onOpenChange,
  onRequestDelete,
}: {
  employment: Employment | null;
  people: Person[];
  initialPersonId: number | null;
  year: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestDelete: (employment: Employment) => void;
}) {
  const utils = api.useUtils();
  const [personId, setPersonId] = useState(
    String(employment?.personId ?? initialPersonId ?? people[0]?.id ?? ""),
  );
  const [employerName, setEmployerName] = useState(
    employment?.employerName ?? "",
  );
  const [payFrequency, setPayFrequency] = useState<PayFrequency>(
    employment?.payFrequency ?? "biweekly",
  );
  const [status, setStatus] = useState<EmploymentStatus>(
    employment?.status ?? "active",
  );
  const [endDate, setEndDate] = useState(employment?.endDate ?? "");
  const [typicalGross, setTypicalGross] = useState(
    centsToDollars(employment?.typicalGrossOverrideCents ?? null),
  );
  const [enabledDeductions, setEnabledDeductions] = useState<
    Record<DeductionEnabledField, boolean>
  >(
    () =>
      Object.fromEntries(
        deductionFields.map((field) => [
          field.enabledField,
          employment?.[field.enabledField] ?? field.defaultEnabled,
        ]),
      ) as Record<DeductionEnabledField, boolean>,
  );
  const [fieldOrder, setFieldOrder] = useState<DeductionAmountField[]>(() =>
    orderedDeductionFields(employment?.deductionFieldOrder).map(
      (field) => field.amountField,
    ),
  );
  const splitIncomeTax = isIncomeTaxSplit(enabledDeductions);
  const orderedFields = orderedDeductionFields(fieldOrder);

  function setDeductionEnabled(field: DeductionEnabledField, enabled: boolean) {
    setEnabledDeductions((current) => {
      if (
        field === "incomeTaxEnabled" &&
        !enabled &&
        isIncomeTaxSplit(current)
      ) {
        return current;
      }
      const next = { ...current, [field]: enabled };
      if (
        (field === "federalIncomeTaxEnabled" ||
          field === "manitobaIncomeTaxEnabled") &&
        enabled
      ) {
        next.incomeTaxEnabled = true;
      }
      return next;
    });
  }

  function moveField(index: number, direction: -1 | 1) {
    setFieldOrder((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved!);
      return next;
    });
  }

  const [phspReportedOnT4, setPhspReportedOnT4] = useState(
    employment?.phspReportedOnT4 ?? false,
  );
  const [unionDuesReportedOnT4, setUnionDuesReportedOnT4] = useState(
    employment?.unionDuesReportedOnT4 ?? false,
  );

  const finish = async (message: string) => {
    await Promise.all([
      utils.employment.list.invalidate(),
      utils.paycheque.list.invalidate(),
      utils.taxItem.list.invalidate(),
      utils.taxItem.overview.invalidate(),
      utils.taxEstimate.get.invalidate(),
    ]);
    toast.success(message);
    onOpenChange(false);
  };
  const tenureEmployments = api.tenureSync.listTenureEmployments.useQuery(
    undefined,
    {
      enabled: open && Boolean(employment),
    },
  );
  const [tenureEmploymentId, setTenureEmploymentId] = useState(
    employment?.tenureEmploymentId ?? "",
  );
  const linkEmployment = api.tenureSync.linkEmployment.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        utils.employment.list.invalidate(),
        utils.tenureSync.status.invalidate(),
      ]);
      if (result.matchedCount > 0) {
        toast.success(
          `Linked employment and matched ${result.matchedCount} existing paycheque(s).`,
        );
      } else {
        toast.success("Tenure employment linked.");
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const create = api.employment.create.useMutation({
    onSuccess: () => finish("Employment added."),
    onError: (error) => toast.error(error.message),
  });
  const update = api.employment.update.useMutation({
    onSuccess: () => finish("Employment updated."),
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const typicalGrossOverrideCents = dollarsToCents(typicalGross);
    if (typicalGross.trim() && typicalGrossOverrideCents === null) {
      toast.error("Typical gross pay must be zero or a positive dollar value.");
      return;
    }
    const values = {
      personId: Number(personId),
      employerName,
      payFrequency,
      status,
      endDate: status === "ended" ? endDate || null : null,
      typicalGrossOverrideCents,
      phspReportedOnT4,
      unionDuesReportedOnT4,
      deductionFieldOrder: fieldOrder,
      ...enabledDeductions,
      incomeTaxEnabled: splitIncomeTax
        ? true
        : enabledDeductions.incomeTaxEnabled,
    };
    if (employment) update.mutate({ id: employment.id, ...values });
    else create.mutate(values);
  }

  const pending = create.isPending || update.isPending;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>
              {employment ? "Edit employment" : "Add employment"}
            </SheetTitle>
            <SheetDescription>
              Each employment keeps its paycheques and calculated income
              separate.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label>Person</Label>
              <Select value={personId} onValueChange={setPersonId}>
                <SelectTrigger aria-label="Person">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={String(person.id)}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employer-name">Employer label</Label>
              <Input
                id="employer-name"
                value={employerName}
                onChange={(event) => setEmployerName(event.target.value)}
                placeholder="e.g. Employer A"
                maxLength={100}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Pay frequency</Label>
              <Select
                value={payFrequency}
                onValueChange={(value) =>
                  setPayFrequency(value as PayFrequency)
                }
              >
                <SelectTrigger aria-label="Pay frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {payFrequencies.map((frequency) => (
                    <SelectItem key={frequency} value={frequency}>
                      {payFrequencyLabels[frequency]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as EmploymentStatus)}
              >
                <SelectTrigger aria-label="Employment status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {employmentStatuses.map((value) => (
                    <SelectItem key={value} value={value}>
                      {employmentStatusLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {status === "ended" ? (
              <div className="space-y-2">
                <Label htmlFor="employment-end-date">End date</Label>
                <Input
                  id="employment-end-date"
                  type="date"
                  min={`${year}-01-01`}
                  max={`${year}-12-31`}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                />
              </div>
            ) : null}
            {employment ? (
              <div className="space-y-2">
                <Label>Tenure employment</Label>
                <Select
                  value={tenureEmploymentId || "__none__"}
                  onValueChange={(value) => {
                    const nextValue = value === "__none__" ? null : value;
                    setTenureEmploymentId(nextValue ?? "");
                    linkEmployment.mutate({
                      employmentId: employment.id,
                      tenureEmploymentId: nextValue,
                      reconcileExisting: true,
                    });
                  }}
                >
                  <SelectTrigger aria-label="Tenure employment">
                    <SelectValue placeholder="Not linked" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not linked</SelectItem>
                    {(tenureEmployments.data?.items ?? []).map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.personName} — {item.employerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Link this employment to Tenure to sync paycheques
                  automatically.
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="typical-gross">Typical gross pay override</Label>
              <div className="relative">
                <span className="text-muted-foreground absolute top-2.5 left-3 text-sm">
                  $
                </span>
                <Input
                  id="typical-gross"
                  className="pl-7 tabular-nums"
                  inputMode="decimal"
                  placeholder="Use average pay"
                  value={typicalGross}
                  onChange={(event) => setTypicalGross(event.target.value)}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Leave blank to project from the average gross pay for this
                employment.
              </p>
            </div>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">
                Paycheque deductions
              </legend>
              <p className="text-muted-foreground text-xs">
                Choose the deduction fields that appear when entering a
                paycheque. Use the arrows to match the order on the pay
                statement.
              </p>
              <div className="space-y-1 rounded-lg border p-2">
                {orderedFields.map((field, index) => {
                  const incomeTaxLocked =
                    field.enabledField === "incomeTaxEnabled" && splitIncomeTax;
                  return (
                    <div
                      key={field.enabledField}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5"
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="border-input accent-primary size-4 rounded disabled:cursor-not-allowed"
                          checked={
                            incomeTaxLocked ||
                            enabledDeductions[field.enabledField]
                          }
                          disabled={incomeTaxLocked}
                          onChange={(event) =>
                            setDeductionEnabled(
                              field.enabledField,
                              event.target.checked,
                            )
                          }
                        />
                        {field.label}
                      </label>
                      <div className="flex shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Move ${field.label} up`}
                          disabled={index === 0}
                          onClick={() => moveField(index, -1)}
                        >
                          <ChevronUpIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Move ${field.label} down`}
                          disabled={index === orderedFields.length - 1}
                          onClick={() => moveField(index, 1)}
                        >
                          <ChevronDownIcon />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {splitIncomeTax ? (
                <p className="text-muted-foreground text-xs">
                  Income tax withheld is calculated as federal plus Manitoba
                  tax. Existing paycheques keep their current total until you
                  edit them and enter the split amounts.
                </p>
              ) : null}
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">T4 reporting</legend>
              <p className="text-muted-foreground text-xs">
                When the employer reports these amounts on the T4, paycheque
                totals are linked to the matching Tax Items.
              </p>
              <div className="space-y-3 rounded-lg border p-4">
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="border-input accent-primary mt-0.5 size-4 rounded"
                    checked={phspReportedOnT4}
                    onChange={(event) =>
                      setPhspReportedOnT4(event.target.checked)
                    }
                  />
                  <span>
                    <span className="font-medium">
                      Employer reports PHSP premiums on T4 (code 85)
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      Extended health and travel medical deductions feed the
                      household medical-expense Tax Item.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="border-input accent-primary mt-0.5 size-4 rounded"
                    checked={unionDuesReportedOnT4}
                    onChange={(event) =>
                      setUnionDuesReportedOnT4(event.target.checked)
                    }
                  />
                  <span>
                    <span className="font-medium">
                      Employer reports union dues on T4 (box 44)
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      Union dues feed a professional-dues Tax Item on line
                      21200.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
          </div>
          <SheetFooter>
            {employment ? (
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                onClick={() => onRequestDelete(employment)}
              >
                Delete employment
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button disabled={pending}>
              {pending
                ? "Saving…"
                : employment
                  ? "Save changes"
                  : "Add employment"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
