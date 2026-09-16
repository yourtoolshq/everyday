"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

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
  payFrequencies,
  payFrequencyLabels,
  type EmploymentStatus,
  type DeductionEnabledField,
  type PayFrequency,
} from "~/domain/employment";
import { centsToDollars, dollarsToCents } from "~/domain/money";
import { api, type RouterOutputs } from "~/trpc/react";

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
  >(() =>
    Object.fromEntries(
      deductionFields.map((field) => [
        field.enabledField,
        employment?.[field.enabledField] ?? field.defaultEnabled,
      ]),
    ) as Record<DeductionEnabledField, boolean>,
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
      ...enabledDeductions,
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
            <SheetTitle>{employment ? "Edit employment" : "Add employment"}</SheetTitle>
            <SheetDescription>
              Each employment keeps its paycheques and calculated income separate.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label>Person</Label>
              <Select value={personId} onValueChange={setPersonId}>
                <SelectTrigger aria-label="Person"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={String(person.id)}>{person.name}</SelectItem>
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
              <Select value={payFrequency} onValueChange={(value) => setPayFrequency(value as PayFrequency)}>
                <SelectTrigger aria-label="Pay frequency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {payFrequencies.map((frequency) => (
                    <SelectItem key={frequency} value={frequency}>{payFrequencyLabels[frequency]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as EmploymentStatus)}>
                <SelectTrigger aria-label="Employment status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {employmentStatuses.map((value) => (
                    <SelectItem key={value} value={value}>{employmentStatusLabels[value]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {status === "ended" ? (
              <div className="space-y-2">
                <Label htmlFor="employment-end-date">End date</Label>
                <Input id="employment-end-date" type="date" min={`${year}-01-01`} max={`${year}-12-31`} value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="typical-gross">Typical gross pay override</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span>
                <Input id="typical-gross" className="pl-7 tabular-nums" inputMode="decimal" placeholder="Use average pay" value={typicalGross} onChange={(event) => setTypicalGross(event.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Leave blank to project from the average gross pay for this employment.
              </p>
            </div>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Paycheque deductions</legend>
              <p className="text-xs text-muted-foreground">
                Choose the deduction fields that appear when entering a paycheque.
              </p>
              <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                {deductionFields.map((field) => (
                  <label
                    key={field.enabledField}
                    className="flex cursor-pointer items-center gap-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input accent-primary"
                      checked={enabledDeductions[field.enabledField]}
                      onChange={(event) =>
                        setEnabledDeductions((current) => ({
                          ...current,
                          [field.enabledField]: event.target.checked,
                        }))
                      }
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <SheetFooter>
            {employment ? (
              <Button type="button" variant="destructive" className="sm:mr-auto" onClick={() => onRequestDelete(employment)}>
                Delete employment
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={pending}>{pending ? "Saving…" : employment ? "Save changes" : "Add employment"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
