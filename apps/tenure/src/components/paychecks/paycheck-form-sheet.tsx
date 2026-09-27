"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FilePreview } from "@yourtoolshq/data-ui";
import { Button } from "@yourtoolshq/ui/button";
import { normalizeDecimalEntry } from "@yourtoolshq/ui/decimal-entry";
import { Input } from "@yourtoolshq/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@yourtoolshq/ui/input-group";
import { Label } from "@yourtoolshq/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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

import type { ExpectedPayPeriod } from "~/lib/expected-pay-periods";
import type { PayFrequency } from "~/lib/pay-frequency";
import type {
  DeductionAmountField,
  DeductionSettings,
} from "~/lib/paycheck-deductions";
import type { RouterOutputs } from "~/trpc/react";
import { documentAccept } from "~/lib/documents";
import {
  canDerivePayPeriods,
  deriveAllSelectablePayPeriods,
  findPayPeriodByKey,
  formatCompactPeriodRange,
  periodKeyForPaycheck,
  suggestDefaultPayPeriodKey,
} from "~/lib/expected-pay-periods";
import { centsToDollars, dollarsToCents, formatCad } from "~/lib/money";
import { suggestPayStubTitle } from "~/lib/pay-stubs";
import {
  calculateNetPay,
  deductionFields,
  isIncomeTaxSplit,
  orderedDeductionFields,
} from "~/lib/paycheck-deductions";
import { FileDropzone, useUpload } from "~/lib/uploads";
import { api } from "~/trpc/react";

type Paycheck = RouterOutputs["paychecks"]["listByEmployment"][number];
type AmountField = "grossPayCents" | DeductionAmountField;

function entryToCents(value: string) {
  const result = normalizeDecimalEntry(value);
  if (!result.ok) return null;
  return dollarsToCents(result.value);
}

type PaycheckFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employmentId: string;
  employerName: string;
  personName: string;
  payFrequency: PayFrequency;
  biweeklyAnchorDate: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "current" | "former";
  deductionSettings: DeductionSettings;
  existingPaychecks: Paycheck[];
  paycheck?: Paycheck | null;
  defaultPeriodKey?: string;
  onSuccess?: () => void;
};

export function PaycheckFormSheet({
  open,
  onOpenChange,
  employmentId,
  employerName,
  personName,
  payFrequency,
  biweeklyAnchorDate,
  startDate,
  endDate,
  status,
  deductionSettings,
  existingPaychecks,
  paycheck,
  defaultPeriodKey,
  onSuccess,
}: PaycheckFormSheetProps) {
  const utils = api.useUtils();
  const attachStub = api.paychecks.attachStub.useMutation();
  const stubUpload = useUpload("document");
  const resetStubUpload = stubUpload.reset;
  const [payDate, setPayDate] = useState("");
  const [periodKey, setPeriodKey] = useState("");
  const [manualPeriodStart, setManualPeriodStart] = useState("");
  const [manualPeriodEnd, setManualPeriodEnd] = useState("");
  const [amounts, setAmounts] = useState<Record<AmountField, string>>(() =>
    emptyAmounts(paycheck),
  );
  const [stubTitle, setStubTitle] = useState("");
  const [stubTitleTouched, setStubTitleTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const lifecycle = useMemo(
    () => ({ startDate, endDate, status }),
    [startDate, endDate, status],
  );
  const usePeriodDropdown = canDerivePayPeriods(lifecycle, payFrequency);

  const coveredPeriodKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of existingPaychecks) {
      if (paycheck && item.id === paycheck.id) continue;
      const key = periodKeyForPaycheck(payFrequency, item.periodStartDate);
      if (key) keys.add(key);
    }
    return keys;
  }, [existingPaychecks, payFrequency, paycheck]);

  const selectablePeriods = useMemo(() => {
    if (!usePeriodDropdown) return [];

    const derived = deriveAllSelectablePayPeriods(
      lifecycle,
      payFrequency,
      biweeklyAnchorDate,
    );

    if (!paycheck) return derived;

    const key = periodKeyForPaycheck(payFrequency, paycheck.periodStartDate);
    if (!key || derived.some((period) => period.key === key)) return derived;

    const synthetic: ExpectedPayPeriod = {
      key,
      label: formatCompactPeriodRange(
        paycheck.periodStartDate,
        paycheck.periodEndDate,
      ),
      shortLabel: formatCompactPeriodRange(
        paycheck.periodStartDate,
        paycheck.periodEndDate,
      ),
      year: Number(paycheck.periodStartDate.slice(0, 4)),
      periodStartDate: paycheck.periodStartDate,
      periodEndDate: paycheck.periodEndDate,
      status: "past_expected",
    };

    return [synthetic, ...derived];
  }, [
    usePeriodDropdown,
    lifecycle,
    payFrequency,
    biweeklyAnchorDate,
    paycheck,
  ]);

  const periodsByYear = useMemo(() => {
    const grouped = new Map<number, ExpectedPayPeriod[]>();
    for (const period of selectablePeriods) {
      const current = grouped.get(period.year) ?? [];
      current.push(period);
      grouped.set(period.year, current);
    }
    return [...grouped.entries()].sort(([left], [right]) => right - left);
  }, [selectablePeriods]);

  const selectedPeriod = findPayPeriodByKey(selectablePeriods, periodKey);
  const periodStartDate = usePeriodDropdown
    ? (selectedPeriod?.periodStartDate ?? "")
    : manualPeriodStart;
  const periodEndDate = usePeriodDropdown
    ? (selectedPeriod?.periodEndDate ?? "")
    : manualPeriodEnd;

  useEffect(() => {
    if (!open) return;
    setPayDate(paycheck?.payDate ?? "");
    setPeriodKey("");
    setManualPeriodStart(paycheck?.periodStartDate ?? "");
    setManualPeriodEnd(paycheck?.periodEndDate ?? "");
    setAmounts(emptyAmounts(paycheck));
    resetStubUpload();
    setStubTitleTouched(false);
  }, [open, paycheck, resetStubUpload]);

  useEffect(() => {
    if (!open || !usePeriodDropdown) return;

    if (paycheck) {
      const key = periodKeyForPaycheck(payFrequency, paycheck.periodStartDate);
      if (key) setPeriodKey(key);
      return;
    }

    if (
      defaultPeriodKey &&
      selectablePeriods.some((period) => period.key === defaultPeriodKey)
    ) {
      setPeriodKey(defaultPeriodKey);
      return;
    }

    setPeriodKey(
      suggestDefaultPayPeriodKey(selectablePeriods, coveredPeriodKeys) ?? "",
    );
  }, [
    open,
    paycheck,
    defaultPeriodKey,
    selectablePeriods,
    coveredPeriodKeys,
    payFrequency,
    usePeriodDropdown,
  ]);

  useEffect(() => {
    if (stubTitleTouched || !periodStartDate || !periodEndDate) return;
    setStubTitle(
      suggestPayStubTitle({
        employerName,
        personName,
        periodStartDate,
        periodEndDate,
        payDate,
      }),
    );
  }, [
    employerName,
    personName,
    periodStartDate,
    periodEndDate,
    payDate,
    stubTitleTouched,
  ]);

  const splitIncomeTax = isIncomeTaxSplit(deductionSettings);
  const visibleFields = useMemo(() => {
    return orderedDeductionFields(deductionSettings.deductionFieldOrder).filter(
      (field) => {
        if (field.amountField === "incomeTaxCents" && splitIncomeTax)
          return true;
        if (
          (field.amountField === "federalIncomeTaxCents" ||
            field.amountField === "manitobaIncomeTaxCents") &&
          !deductionSettings[field.enabledField]
        ) {
          return false;
        }
        return (
          deductionSettings[field.enabledField] ||
          (entryToCents(amounts[field.amountField]) ?? 0) > 0
        );
      },
    );
  }, [amounts, deductionSettings, splitIncomeTax]);

  const parsedAmounts = useMemo(() => {
    const values = Object.fromEntries(
      (
        [
          "grossPayCents",
          ...deductionFields.map((field) => field.amountField),
        ] as const
      ).map((field) => [field, entryToCents(amounts[field])]),
    ) as Record<AmountField, number | null>;

    if (
      splitIncomeTax &&
      values.federalIncomeTaxCents !== null &&
      values.manitobaIncomeTaxCents !== null
    ) {
      values.incomeTaxCents =
        values.federalIncomeTaxCents + values.manitobaIncomeTaxCents;
    }

    return values;
  }, [amounts, splitIncomeTax]);

  const netPayCents = Object.values(parsedAmounts).some(
    (value) => value === null,
  )
    ? null
    : calculateNetPay(parsedAmounts as Record<AmountField, number>);

  const createPaycheck = api.paychecks.create.useMutation();
  const updatePaycheck = api.paychecks.update.useMutation();

  async function invalidate() {
    await Promise.all([
      utils.paychecks.listByEmployment.invalidate({ employmentId }),
      utils.paychecks.periodCompleteness.invalidate({ employmentId }),
      utils.paychecks.listForReview.invalidate(),
      utils.documents.listByEmployment.invalidate({ employmentId }),
      utils.overview.summary.invalidate(),
      utils.overview.paySummary.invalidate(),
      utils.employmentRecords.paySummaryByEmployment.invalidate({
        employmentId,
      }),
    ]);
  }

  async function submitPaycheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (usePeriodDropdown && !periodKey) {
      toast.error("Choose a pay period.");
      return;
    }
    if (!payDate || !periodStartDate || !periodEndDate) {
      toast.error("Enter pay date and pay period.");
      return;
    }
    if (periodEndDate < periodStartDate) {
      toast.error("Pay period end must be on or after the start date.");
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

    const payload = {
      employmentId,
      payDate,
      periodStartDate,
      periodEndDate,
      grossPayCents: parsedAmounts.grossPayCents!,
      incomeTaxCents: parsedAmounts.incomeTaxCents!,
      federalIncomeTaxCents: parsedAmounts.federalIncomeTaxCents!,
      manitobaIncomeTaxCents: parsedAmounts.manitobaIncomeTaxCents!,
      cppCents: parsedAmounts.cppCents!,
      cpp2Cents: parsedAmounts.cpp2Cents!,
      eiCents: parsedAmounts.eiCents!,
      wiCents: parsedAmounts.wiCents!,
      ltdCents: parsedAmounts.ltdCents!,
      extendedHealthCents: parsedAmounts.extendedHealthCents!,
      travelMedicalCents: parsedAmounts.travelMedicalCents!,
      unionDuesCents: parsedAmounts.unionDuesCents!,
      otherDeductionsCents: parsedAmounts.otherDeductionsCents!,
    };

    setSubmitting(true);
    try {
      const saved = paycheck
        ? await updatePaycheck.mutateAsync({ id: paycheck.id, ...payload })
        : await createPaycheck.mutateAsync(payload);

      const uploadedStub = stubUpload.file;
      if (uploadedStub) {
        await attachStub.mutateAsync({
          paycheckId: saved.id,
          file: uploadedStub.token,
          title: stubTitle,
        });
      }

      await invalidate();
      toast.success(
        paycheck
          ? uploadedStub
            ? "Paycheck updated and pay stub attached."
            : "Paycheck updated."
          : uploadedStub
            ? "Paycheck added and pay stub attached."
            : "Paycheck added.",
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save paycheck.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submitPaycheck}>
          <SheetHeader>
            <SheetTitle>
              {paycheck ? "Edit paycheck" : "Add paycheck"}
            </SheetTitle>
            <SheetDescription>
              Enter the amounts shown on the pay statement. Net pay is
              calculated for comparison.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {usePeriodDropdown ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Pay period</Label>
                  <Select
                    value={periodKey}
                    onValueChange={setPeriodKey}
                    disabled={selectablePeriods.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose pay period" />
                    </SelectTrigger>
                    <SelectContent>
                      {periodsByYear.map(([year, periods]) => (
                        <SelectGroup key={year}>
                          <SelectLabel>{year}</SelectLabel>
                          {periods.map((period) => (
                            <SelectItem key={period.key} value={period.key}>
                              {period.label}
                              {coveredPeriodKeys.has(period.key)
                                ? " · Recorded"
                                : ""}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectablePeriods.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Set a start date and pay frequency to choose expected pay
                      periods.
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="paycheck-period-start">
                      Pay period start
                    </Label>
                    <Input
                      id="paycheck-period-start"
                      type="date"
                      value={manualPeriodStart}
                      onChange={(event) =>
                        setManualPeriodStart(event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paycheck-period-end">Pay period end</Label>
                    <Input
                      id="paycheck-period-end"
                      type="date"
                      value={manualPeriodEnd}
                      onChange={(event) =>
                        setManualPeriodEnd(event.target.value)
                      }
                      required
                    />
                  </div>
                </>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="paycheck-pay-date">Pay date</Label>
                <Input
                  id="paycheck-pay-date"
                  type="date"
                  value={payDate}
                  onChange={(event) => setPayDate(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="paycheck-gross">Gross pay</Label>
                <DollarInput
                  id="paycheck-gross"
                  value={amounts.grossPayCents}
                  onChange={(value) =>
                    setAmounts((current) => ({
                      ...current,
                      grossPayCents: value,
                    }))
                  }
                  required
                />
              </div>

              {visibleFields.map((field) => {
                const computedIncomeTax =
                  field.amountField === "incomeTaxCents" && splitIncomeTax;

                return (
                  <div key={field.amountField} className="space-y-2">
                    <Label htmlFor={`paycheck-${field.amountField}`}>
                      {field.label}
                    </Label>
                    <DollarInput
                      id={`paycheck-${field.amountField}`}
                      value={
                        computedIncomeTax
                          ? parsedAmounts.incomeTaxCents === null
                            ? ""
                            : centsToDollars(parsedAmounts.incomeTaxCents)
                          : amounts[field.amountField]
                      }
                      onChange={(value) =>
                        setAmounts((current) => ({
                          ...current,
                          [field.amountField]: value,
                        }))
                      }
                      readOnly={computedIncomeTax}
                      required={!computedIncomeTax}
                    />
                    {computedIncomeTax ? (
                      <p className="text-muted-foreground text-xs">
                        Sum of federal and Manitoba tax withheld.
                      </p>
                    ) : null}
                  </div>
                );
              })}

              <div className="sm:col-span-2">
                <div className="bg-muted/40 rounded-lg border p-4">
                  <p className="text-sm font-medium">Calculated net pay</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {netPayCents === null || netPayCents < 0
                      ? "—"
                      : formatCad(netPayCents)}
                  </p>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Compare this with the pay stub. If it does not match, check
                    your line items.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Pay stub</p>
                <p className="text-muted-foreground text-xs">
                  Attach the original PDF or image now, or add it later.
                </p>
              </div>

              {paycheck?.documentId &&
              paycheck.documentFileId &&
              paycheck.documentMimeType &&
              !stubUpload.source ? (
                <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className="truncate">
                    {paycheck.documentTitle ??
                      paycheck.documentFilename ??
                      "Attached pay stub"}
                  </span>
                  <Button type="button" size="sm" variant="outline" asChild>
                    <FilePreview
                      file={{
                        id: paycheck.documentFileId,
                        mimeType: paycheck.documentMimeType,
                      }}
                    >
                      View
                    </FilePreview>
                  </Button>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="paycheck-stub-file">
                  {paycheck?.documentId ? "Replace pay stub" : "Pay stub file"}
                </Label>
                <FileDropzone
                  id="paycheck-stub-file"
                  upload={stubUpload}
                  accept={documentAccept}
                />
                <p className="text-muted-foreground text-xs">
                  PDF, JPEG, PNG, WebP, HEIC, or EML up to 25 MB.
                </p>
              </div>

              {stubUpload.source ? (
                <div className="space-y-2">
                  <Label htmlFor="paycheck-stub-title">Stub title</Label>
                  <Input
                    id="paycheck-stub-title"
                    value={stubTitle}
                    onChange={(event) => {
                      setStubTitleTouched(true);
                      setStubTitle(event.target.value);
                    }}
                    placeholder="Pay stub"
                  />
                  <p className="text-muted-foreground text-xs">
                    Suggested from the pay period and employer. You can edit it
                    before saving.
                  </p>
                </div>
              ) : null}
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
            <Button
              type="submit"
              disabled={submitting || stubUpload.status === "uploading"}
            >
              {submitting
                ? "Saving…"
                : paycheck
                  ? "Save changes"
                  : "Add paycheck"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function DollarInput({
  id,
  value,
  onChange,
  readOnly,
  required,
}: {
  id: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  required?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <InputGroup>
        <InputGroupInput
          id={id}
          className="tabular-nums"
          inputMode="decimal"
          value={value}
          onChange={(event) => {
            setError(null);
            onChange?.(event.target.value);
          }}
          onBlur={() => {
            if (readOnly || !onChange) return;
            const result = normalizeDecimalEntry(value);
            if (result.ok) {
              onChange(result.value);
              setError(null);
              return;
            }
            setError(result.message);
          }}
          readOnly={readOnly}
          aria-invalid={Boolean(error)}
          required={required}
        />
        <InputGroupAddon>
          <InputGroupText>$</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

function emptyAmounts(paycheck?: Paycheck | null): Record<AmountField, string> {
  return {
    grossPayCents: centsToDollars(paycheck?.grossPayCents ?? null),
    ...Object.fromEntries(
      deductionFields.map((field) => [
        field.amountField,
        centsToDollars(paycheck?.[field.amountField] ?? 0),
      ]),
    ),
  } as Record<AmountField, string>;
}
