"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@yourtoolshq/ui/button";
import { DateField } from "@yourtoolshq/ui/date-field";
import { normalizeDecimalEntry } from "@yourtoolshq/ui/decimal-entry";
import { Label } from "@yourtoolshq/ui/label";
import { MoneyField } from "@yourtoolshq/ui/money-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@yourtoolshq/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@yourtoolshq/ui/sheet";

import type { DeductionAmountField } from "~/domain/employment";
import type { RouterOutputs } from "~/trpc/react";
import {
  calculateNetPay,
  deductionFields,
  isIncomeTaxSplit,
  orderedDeductionFields,
} from "~/domain/employment";
import { centsToDollars, dollarsToCents } from "~/domain/money";
import { api } from "~/trpc/react";

type Employment = RouterOutputs["employment"]["list"]["items"][number];
type Paycheque = RouterOutputs["paycheque"]["list"]["items"][number];

type AmountField = "grossPayCents" | DeductionAmountField;

function entryToCents(value: string) {
  const result = normalizeDecimalEntry(value);
  if (!result.ok) return null;
  return dollarsToCents(result.value);
}

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
    String(
      paycheque?.employmentId ??
        initialEmploymentId ??
        employments[0]?.id ??
        "",
    ),
  );
  const [payDate, setPayDate] = useState(paycheque?.payDate ?? "");
  const [amountErrors, setAmountErrors] = useState<
    Partial<Record<AmountField, string>>
  >({});
  const [amounts, setAmounts] = useState<Record<AmountField, string>>(
    () =>
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
  const splitIncomeTax = selectedEmployment
    ? isIncomeTaxSplit(selectedEmployment)
    : false;
  const visibleDeductionFields = orderedDeductionFields(
    selectedEmployment?.deductionFieldOrder,
  ).filter((field) => {
    if (field.amountField === "incomeTaxCents" && splitIncomeTax) return true;
    if (
      (field.amountField === "federalIncomeTaxCents" ||
        field.amountField === "manitobaIncomeTaxCents") &&
      !selectedEmployment?.[field.enabledField]
    ) {
      return false;
    }
    return (
      Boolean(selectedEmployment?.[field.enabledField]) ||
      (entryToCents(amounts[field.amountField]) ?? 0) > 0
    );
  });
  const parsedAmounts = Object.fromEntries(
    (
      [
        "grossPayCents",
        ...deductionFields.map((field) => field.amountField),
      ] as const
    ).map((field) => [field, entryToCents(amounts[field])]),
  ) as Record<AmountField, number | null>;
  if (
    splitIncomeTax &&
    parsedAmounts.federalIncomeTaxCents !== null &&
    parsedAmounts.manitobaIncomeTaxCents !== null
  ) {
    parsedAmounts.incomeTaxCents =
      parsedAmounts.federalIncomeTaxCents +
      parsedAmounts.manitobaIncomeTaxCents;
  }
  const netPayCents = Object.values(parsedAmounts).some(
    (value) => value === null,
  )
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
    const expressionErrors: Partial<Record<AmountField, string>> = {};
    for (const field of [
      "grossPayCents",
      ...deductionFields.map((item) => item.amountField),
    ] as const) {
      if (field === "incomeTaxCents" && splitIncomeTax) continue;
      const result = normalizeDecimalEntry(amounts[field]);
      if (!result.ok) expressionErrors[field] = result.message;
    }
    if (Object.values(expressionErrors).some(Boolean)) {
      setAmountErrors(expressionErrors);
      return;
    }
    const invalid = (
      [
        ["grossPayCents", "Gross pay"],
        ...deductionFields.map(
          (field) => [field.amountField, field.label] as const,
        ),
      ] as const
    ).find(([field]) => parsedAmounts[field] === null);
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
            <SheetTitle>
              {paycheque ? "Edit paycheque" : "Add paycheque"}
            </SheetTitle>
            <SheetDescription>
              Enter the amounts shown on the pay statement. Net pay is
              calculated for comparison.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label>Employment</Label>
              <Select value={employmentId} onValueChange={setEmploymentId}>
                <SelectTrigger aria-label="Employment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {employments.map((employment) => (
                    <SelectItem
                      key={employment.id}
                      value={String(employment.id)}
                    >
                      {employment.personName} — {employment.employerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-date">Pay date</Label>
              <DateField
                id="pay-date"
                min={`${year}-01-01`}
                max={`${year}-12-31`}
                value={payDate}
                onChange={(value) => setPayDate(value)}
                required
              />
              <p className="text-muted-foreground text-xs">
                The pay date determines the tax year.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="grossPayCents">Gross pay</Label>
                <MoneyField
                  id="grossPayCents"
                  value={amounts.grossPayCents}
                  error={amountErrors.grossPayCents}
                  onValueChange={(next) => {
                    setAmounts((current) => ({
                      ...current,
                      grossPayCents: next,
                    }));
                    setAmountErrors((current) => ({
                      ...current,
                      grossPayCents: undefined,
                    }));
                  }}
                  required
                />
              </div>
              {visibleDeductionFields.map((field) => {
                const computedIncomeTax =
                  field.amountField === "incomeTaxCents" && splitIncomeTax;
                return (
                  <div key={field.amountField} className="space-y-2">
                    <Label htmlFor={field.amountField}>{field.label}</Label>
                    <MoneyField
                      id={field.amountField}
                      value={
                        computedIncomeTax
                          ? parsedAmounts.incomeTaxCents === null
                            ? ""
                            : centsToDollars(parsedAmounts.incomeTaxCents)
                          : amounts[field.amountField]
                      }
                      error={amountErrors[field.amountField]}
                      readOnly={computedIncomeTax}
                      arithmetic={!computedIncomeTax}
                      required={!computedIncomeTax}
                      onValueChange={(next) => {
                        setAmounts((current) => ({
                          ...current,
                          [field.amountField]: next,
                        }));
                        setAmountErrors((current) => ({
                          ...current,
                          [field.amountField]: undefined,
                        }));
                      }}
                    />
                    {computedIncomeTax ? (
                      <p className="text-muted-foreground text-xs">
                        Sum of federal and Manitoba tax withheld.
                      </p>
                    ) : null}
                  </div>
                );
              })}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="calculated-net-pay">Net pay (calculated)</Label>
                <MoneyField
                  id="calculated-net-pay"
                  value={
                    netPayCents === null || netPayCents < 0
                      ? ""
                      : centsToDollars(netPayCents)
                  }
                  readOnly
                  arithmetic={false}
                />
                <p className="text-muted-foreground text-xs">
                  Compare this amount with the pay statement. A difference
                  usually means a deduction is missing or incorrect.
                </p>
              </div>
            </div>
          </div>
          <SheetFooter>
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
                : paycheque
                  ? "Save changes"
                  : "Add paycheque"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
