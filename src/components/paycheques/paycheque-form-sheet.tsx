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
  calculateNetPay,
  deductionFields,
  type DeductionAmountField,
} from "~/domain/employment";
import { centsToDollars, dollarsToCents } from "~/domain/money";
import { api, type RouterOutputs } from "~/trpc/react";

type Employment = RouterOutputs["employment"]["list"]["items"][number];
type Paycheque = RouterOutputs["paycheque"]["list"]["items"][number];

type AmountField = "grossPayCents" | DeductionAmountField;

export function PaychequeFormSheet({
  paycheque,
  employments,
  initialEmploymentId,
  year,
  open,
  onOpenChange,
}: {
  paycheque: Paycheque | null;
  employments: Employment[];
  initialEmploymentId: number | null;
  year: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const [employmentId, setEmploymentId] = useState(
    String(paycheque?.employmentId ?? initialEmploymentId ?? employments[0]?.id ?? ""),
  );
  const [payDate, setPayDate] = useState(paycheque?.payDate ?? "");
  const [amounts, setAmounts] = useState<Record<AmountField, string>>(() =>
    ({
      grossPayCents: centsToDollars(paycheque?.grossPayCents ?? null),
      ...Object.fromEntries(
        deductionFields.map((field) => [
          field.amountField,
          centsToDollars(paycheque?.[field.amountField] ?? 0),
        ]),
      ),
    }) as Record<AmountField, string>,
  );

  const selectedEmployment = employments.find(
    (employment) => String(employment.id) === employmentId,
  );
  const visibleDeductionFields = deductionFields.filter(
    (field) =>
      selectedEmployment?.[field.enabledField] ||
      (dollarsToCents(amounts[field.amountField]) ?? 0) > 0,
  );
  const parsedAmounts = Object.fromEntries(
    (["grossPayCents", ...deductionFields.map((field) => field.amountField)] as const)
      .map((field) => [field, dollarsToCents(amounts[field])]),
  ) as Record<AmountField, number | null>;
  const netPayCents = Object.values(parsedAmounts).some((value) => value === null)
    ? null
    : calculateNetPay(parsedAmounts as Record<AmountField, number>);

  const finish = async (message: string) => {
    await Promise.all([
      utils.paycheque.list.invalidate(),
      utils.employment.list.invalidate(),
      utils.taxItem.list.invalidate(),
      utils.taxItem.overview.invalidate(),
      utils.taxEstimate.get.invalidate(),
    ]);
    toast.success(message);
    onOpenChange(false);
  };
  const create = api.paycheque.create.useMutation({
    onSuccess: () => finish("Paycheque added."),
    onError: (error) => toast.error(error.message),
  });
  const update = api.paycheque.update.useMutation({
    onSuccess: () => finish("Paycheque updated."),
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = ([
      ["grossPayCents", "Gross pay"],
      ...deductionFields.map((field) => [field.amountField, field.label] as const),
    ] as const).find(([field]) => parsedAmounts[field] === null);
    if (invalid) {
      toast.error(`${invalid[1]} must be zero or a positive dollar value.`);
      return;
    }
    if (netPayCents === null || netPayCents < 0) {
      toast.error("Total deductions cannot exceed gross pay.");
      return;
    }
    const values = {
      employmentId: Number(employmentId),
      payDate,
      ...(parsedAmounts as Record<AmountField, number>),
    };
    if (paycheque) update.mutate({ id: paycheque.id, ...values });
    else create.mutate(values);
  }

  const pending = create.isPending || update.isPending;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>{paycheque ? "Edit paycheque" : "Add paycheque"}</SheetTitle>
            <SheetDescription>
              Enter the amounts shown on the pay statement. Net pay is calculated for comparison.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label>Employment</Label>
              <Select value={employmentId} onValueChange={setEmploymentId}>
                <SelectTrigger aria-label="Employment"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {employments.map((employment) => (
                    <SelectItem key={employment.id} value={String(employment.id)}>
                      {employment.personName} — {employment.employerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-date">Pay date</Label>
              <Input id="pay-date" type="date" min={`${year}-01-01`} max={`${year}-12-31`} value={payDate} onChange={(event) => setPayDate(event.target.value)} required />
              <p className="text-xs text-muted-foreground">The pay date determines the tax year.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="grossPayCents">Gross pay</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span>
                  <Input
                    id="grossPayCents"
                    className="pl-7 tabular-nums"
                    inputMode="decimal"
                    value={amounts.grossPayCents}
                    onChange={(event) => setAmounts((current) => ({ ...current, grossPayCents: event.target.value }))}
                    required
                  />
                </div>
              </div>
              {visibleDeductionFields.map((field) => (
                <div key={field.amountField} className="space-y-2">
                  <Label htmlFor={field.amountField}>{field.label}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span>
                    <Input
                      id={field.amountField}
                      className="pl-7 tabular-nums"
                      inputMode="decimal"
                      value={amounts[field.amountField]}
                      onChange={(event) => setAmounts((current) => ({
                        ...current,
                        [field.amountField]: event.target.value,
                      }))}
                      required
                    />
                  </div>
                </div>
              ))}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="calculated-net-pay">Net pay (calculated)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span>
                  <Input
                    id="calculated-net-pay"
                    className="pl-7 tabular-nums"
                    value={netPayCents === null || netPayCents < 0 ? "" : centsToDollars(netPayCents)}
                    readOnly
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Compare this amount with the pay statement. A difference usually means a deduction is missing or incorrect.
                </p>
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={pending}>{pending ? "Saving…" : paycheque ? "Save changes" : "Add paycheque"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
