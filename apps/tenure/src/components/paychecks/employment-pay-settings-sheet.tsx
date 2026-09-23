"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

import type { DeductionSettings } from "~/lib/paycheck-deductions";
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
import { payFrequencies, payFrequencyLabels } from "~/lib/pay-frequency";
import {
  deductionFields,
  normalizeDeductionFieldOrder,
} from "~/lib/paycheck-deductions";
import { api } from "~/trpc/react";

type EmploymentPaySettingsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employmentId: string;
  payFrequency: (typeof payFrequencies)[number];
  biweeklyAnchorDate: string | null;
  deductionSettings: DeductionSettings;
  onSuccess?: () => void;
};

export function EmploymentPaySettingsSheet({
  open,
  onOpenChange,
  employmentId,
  payFrequency: initialPayFrequency,
  biweeklyAnchorDate: initialBiweeklyAnchorDate,
  deductionSettings: initialDeductionSettings,
  onSuccess,
}: EmploymentPaySettingsSheetProps) {
  const utils = api.useUtils();
  const [payFrequency, setPayFrequency] =
    useState<(typeof payFrequencies)[number]>(initialPayFrequency);
  const [biweeklyAnchorDate, setBiweeklyAnchorDate] = useState(
    initialBiweeklyAnchorDate ?? "",
  );
  const [settings, setSettings] = useState<DeductionSettings>(
    initialDeductionSettings,
  );

  useEffect(() => {
    if (!open) return;
    setPayFrequency(initialPayFrequency);
    setBiweeklyAnchorDate(initialBiweeklyAnchorDate ?? "");
    setSettings(initialDeductionSettings);
  }, [
    open,
    initialPayFrequency,
    initialBiweeklyAnchorDate,
    initialDeductionSettings,
  ]);

  const updatePaySettings = api.employments.updatePaySettings.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.employments.getById.invalidate({ id: employmentId }),
        utils.paychecks.periodCompleteness.invalidate({ employmentId }),
        utils.paychecks.listForReview.invalidate(),
      ]);
      toast.success("Pay settings updated.");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => toast.error(error.message),
  });

  const orderedFields = normalizeDeductionFieldOrder(
    settings.deductionFieldOrder,
  ).map((amountField) =>
    deductionFields.find((field) => field.amountField === amountField)!,
  );

  function moveField(amountField: string, direction: -1 | 1) {
    const order = normalizeDeductionFieldOrder(settings.deductionFieldOrder);
    const index = order.indexOf(amountField as (typeof order)[number]);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setSettings((current) => ({ ...current, deductionFieldOrder: next }));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Pay settings</SheetTitle>
          <SheetDescription>
            Configure pay frequency and which deduction lines appear on paycheck
            entry.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col gap-4 px-4 pb-4"
          onSubmit={(event) => {
            event.preventDefault();
            updatePaySettings.mutate({
              employmentId,
              payFrequency,
              biweeklyAnchorDate:
                payFrequency === "biweekly" || payFrequency === "weekly"
                  ? biweeklyAnchorDate || null
                  : null,
              deductionSettings: settings,
            });
          }}
        >
          <div className="space-y-2">
            <Label>Pay frequency</Label>
            <Select
              value={payFrequency}
              onValueChange={(value) =>
                setPayFrequency(value as (typeof payFrequencies)[number])
              }
            >
              <SelectTrigger>
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

          {payFrequency === "weekly" || payFrequency === "biweekly" ? (
            <div className="space-y-2">
              <Label htmlFor="pay-anchor-date">Schedule anchor date</Label>
              <Input
                id="pay-anchor-date"
                type="date"
                value={biweeklyAnchorDate}
                onChange={(event) => setBiweeklyAnchorDate(event.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                First day of a pay period on this schedule. Defaults to
                employment start date when left blank.
              </p>
            </div>
          ) : null}

          <div className="space-y-3">
            <Label>Deduction lines on paycheck entry</Label>
            <ul className="divide-y rounded-lg border">
              {orderedFields.map((field) => (
                <li
                  key={field.amountField}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <label className="flex flex-1 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings[field.enabledField]}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          [field.enabledField]: event.target.checked,
                        }))
                      }
                    />
                    {field.label}
                  </label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => moveField(field.amountField, -1)}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => moveField(field.amountField, 1)}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <SheetFooter className="px-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updatePaySettings.isPending}>
              Save pay settings
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
