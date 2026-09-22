"use client";

import { useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import type {
  PaycheckColumnMapping,
  PaycheckImportPreview,
} from "~/lib/paycheck-csv-import";
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
import { formatCad } from "~/lib/money";
import {
  detectPaycheckColumnMapping,
  paycheckImportFields,
} from "~/lib/paycheck-csv-import";
import { api } from "~/trpc/react";

const fieldLabels: Record<(typeof paycheckImportFields)[number], string> = {
  payDate: "Pay date",
  periodStartDate: "Pay period start",
  periodEndDate: "Pay period end",
  grossPayCents: "Gross pay (cents)",
  incomeTaxCents: "Income tax (cents)",
  federalIncomeTaxCents: "Federal tax (cents)",
  manitobaIncomeTaxCents: "Manitoba tax (cents)",
  cppCents: "CPP (cents)",
  cpp2Cents: "CPP2 (cents)",
  eiCents: "EI (cents)",
  wiCents: "WI (cents)",
  ltdCents: "LTD (cents)",
  extendedHealthCents: "Extended health (cents)",
  travelMedicalCents: "Travel medical (cents)",
  unionDuesCents: "Union dues (cents)",
  otherDeductionsCents: "Other deductions (cents)",
};

type PaycheckImportSheetProps = {
  employmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PaycheckImportSheet({
  employmentId,
  open,
  onOpenChange,
}: PaycheckImportSheetProps) {
  const utils = api.useUtils();
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<PaycheckColumnMapping>({});
  const [preview, setPreview] = useState<PaycheckImportPreview | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [step, setStep] = useState<"upload" | "mapping" | "preview">("upload");

  const previewImport = api.paychecks.previewImport.useMutation({
    onSuccess: (data) => {
      setPreview(data);
      setStep("preview");
    },
    onError: (error) => toast.error(error.message),
  });

  const importPaychecks = api.paychecks.import.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        utils.paychecks.listByEmployment.invalidate({ employmentId }),
        utils.paychecks.periodCompleteness.invalidate(),
        utils.paychecks.listForReview.invalidate(),
        utils.overview.paySummary.invalidate(),
      ]);
      toast.success(
        `Imported ${result.importedCount} paycheck${result.importedCount === 1 ? "" : "s"}.`,
      );
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!open) {
      setCsvText("");
      setFileName(null);
      setMapping({});
      setPreview(null);
      setSkipDuplicates(true);
      setStep("upload");
    }
  }, [open]);

  const headers = useMemo(() => {
    if (!csvText.trim()) return [];
    return csvText.trim().split(/\r?\n/)[0]?.split(",") ?? [];
  }, [csvText]);

  const needsMapping = useMemo(() => {
    const detected = detectPaycheckColumnMapping(headers);
    return !detected.payDate || !detected.grossPayCents;
  }, [headers]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setFileName(file.name);
    const detected = detectPaycheckColumnMapping(
      text.trim().split(/\r?\n/)[0]?.split(",") ?? [],
    );
    setMapping(detected);
    setPreview(null);
    setStep(needsMappingForHeaders(text) ? "mapping" : "upload");
  }

  function needsMappingForHeaders(text: string) {
    const fileHeaders = text.trim().split(/\r?\n/)[0]?.split(",") ?? [];
    const detected = detectPaycheckColumnMapping(fileHeaders);
    return !detected.payDate || !detected.grossPayCents;
  }

  function continueFromUpload() {
    if (!csvText.trim()) {
      toast.error("Choose a CSV file to import.");
      return;
    }
    if (needsMapping) {
      setStep("mapping");
      return;
    }
    previewImport.mutate({ employmentId, csvText, mapping });
  }

  function continueFromMapping() {
    if (!mapping.payDate || !mapping.grossPayCents) {
      toast.error("Map at least pay date and gross pay.");
      return;
    }
    previewImport.mutate({ employmentId, csvText, mapping });
  }

  const importableCount = preview
    ? preview.rows.filter(
        (row) =>
          row.errors.length === 0 && (!skipDuplicates || !row.isDuplicate),
      ).length
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Import paychecks from CSV</SheetTitle>
          <SheetDescription>
            Import paycheques exported from Taxbook for this employment. Pay
            stubs and estimated pay periods can be reviewed after import.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {step === "upload" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paycheck-import-file">CSV file</Label>
                <Input
                  id="paycheck-import-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                />
                {fileName ? (
                  <p className="text-muted-foreground text-xs">
                    Selected: {fileName}
                  </p>
                ) : null}
              </div>
              <p className="text-muted-foreground text-sm">
                Taxbook exports use a preset column layout. Other CSV files can
                be mapped in the next step.
              </p>
            </div>
          ) : null}

          {step === "mapping" ? (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Match CSV columns to paycheck fields. Unmapped optional amounts
                default to zero.
              </p>
              <div className="grid gap-3">
                {paycheckImportFields.map((field) => (
                  <div
                    key={field}
                    className="grid gap-2 sm:grid-cols-2 sm:items-center"
                  >
                    <Label>{fieldLabels[field]}</Label>
                    <Select
                      value={mapping[field] ?? "__none__"}
                      onValueChange={(value) =>
                        setMapping((current) => ({
                          ...current,
                          [field]: value === "__none__" ? undefined : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Not mapped" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not mapped</SelectItem>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === "preview" && preview ? (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  {preview.validCount} valid row
                  {preview.validCount === 1 ? "" : "s"}
                </p>
                <p>
                  {preview.duplicateCount} duplicate
                  {preview.duplicateCount === 1 ? "" : "s"}
                </p>
                <p>
                  {preview.errorCount} row{preview.errorCount === 1 ? "" : "s"}{" "}
                  with errors
                </p>
                <p>
                  {preview.estimatedPeriodCount} estimated pay period
                  {preview.estimatedPeriodCount === 1 ? "" : "s"}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(event) => setSkipDuplicates(event.target.checked)}
                />
                Skip rows that match an existing paycheck
              </label>
              <p className="text-muted-foreground text-sm">
                {importableCount} paycheck{importableCount === 1 ? "" : "s"}{" "}
                will be imported. Imported paychecks will not include pay stub
                PDFs.
              </p>
              <div className="max-h-80 overflow-auto rounded-md border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-2">Row</th>
                      <th className="px-2 py-2">Pay date</th>
                      <th className="px-2 py-2">Period</th>
                      <th className="px-2 py-2">Gross</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.rowNumber} className="border-t align-top">
                        <td className="px-2 py-2">{row.rowNumber}</td>
                        <td className="px-2 py-2">{row.payDate || "—"}</td>
                        <td className="px-2 py-2">
                          {row.periodStartDate && row.periodEndDate
                            ? `${row.periodStartDate} – ${row.periodEndDate}`
                            : "—"}
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          {row.grossPayCents
                            ? formatCad(row.grossPayCents)
                            : "—"}
                        </td>
                        <td className="px-2 py-2">
                          {row.errors.length > 0
                            ? row.errors.join(" ")
                            : row.isDuplicate
                              ? "Duplicate"
                              : row.periodStrategy === "mapped"
                                ? "Ready"
                                : "Estimated period"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        <SheetFooter className="border-t px-4 py-4">
          {step === "upload" ? (
            <Button
              onClick={continueFromUpload}
              disabled={!csvText || previewImport.isPending}
            >
              <Upload />
              {previewImport.isPending ? "Previewing…" : "Continue"}
            </Button>
          ) : null}
          {step === "mapping" ? (
            <div className="flex w-full gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={continueFromMapping}
                disabled={previewImport.isPending}
              >
                {previewImport.isPending ? "Previewing…" : "Preview import"}
              </Button>
            </div>
          ) : null}
          {step === "preview" ? (
            <div className="flex w-full gap-2">
              <Button
                variant="outline"
                onClick={() => setStep(needsMapping ? "mapping" : "upload")}
              >
                Back
              </Button>
              <Button
                disabled={importableCount === 0 || importPaychecks.isPending}
                onClick={() =>
                  importPaychecks.mutate({
                    employmentId,
                    csvText,
                    mapping,
                    skipDuplicates,
                  })
                }
              >
                {importPaychecks.isPending
                  ? "Importing…"
                  : `Import ${importableCount} paycheck${importableCount === 1 ? "" : "s"}`}
              </Button>
            </div>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
