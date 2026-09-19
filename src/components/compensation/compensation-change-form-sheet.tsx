"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
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
import { Textarea } from "~/components/ui/textarea";
import {
  basisPointsToCommissionPercent,
  commissionPercentToBasisPoints,
  compensationCurrencies,
  compensationCurrencyLabels,
  compensationTypeLabels,
  compensationTypes,
  type CompensationCurrency,
  type CompensationType,
} from "~/lib/compensation";
import { documentTypes, documentTypeLabels, titleFromFilename } from "~/lib/documents";
import { centsToDollars, dollarsToCents } from "~/lib/money";
import { uploadEmploymentDocument } from "~/lib/upload-employment-document";
import { api, type RouterOutputs } from "~/trpc/react";

type CompensationChange = RouterOutputs["compensationChanges"]["listByEmployment"][number];
type Document = RouterOutputs["documents"]["listByEmployment"][number];

type CompensationChangeFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employmentId: string;
  mode: "create" | "edit";
  change?: CompensationChange | null;
  defaultEffectiveDate?: string | null;
};

export function CompensationChangeFormSheet({
  open,
  onOpenChange,
  employmentId,
  mode,
  change,
  defaultEffectiveDate,
}: CompensationChangeFormSheetProps) {
  const utils = api.useUtils();
  const documents = api.documents.listByEmployment.useQuery({ employmentId }, { enabled: open });
  const discussions = api.discussions.listByEmployment.useQuery({ employmentId }, { enabled: open });

  const [type, setType] = useState<CompensationType>("annual_salary");
  const [currency, setCurrency] = useState<CompensationCurrency>("CAD");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [amount, setAmount] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [notes, setNotes] = useState("");
  const [discussionId, setDiscussionId] = useState("none");
  const [documentMode, setDocumentMode] = useState<"none" | "existing" | "upload">("none");
  const [existingDocumentId, setExistingDocumentId] = useState("none");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentTitleTouched, setDocumentTitleTouched] = useState(false);
  const [documentType, setDocumentType] = useState<"salary_letter" | "promotion_letter" | "offer_letter" | "employment_letter" | "other">("salary_letter");
  const [submitting, setSubmitting] = useState(false);

  const supportingDocuments = useMemo(
    () => (documents.data ?? []).filter((document) => document.type !== "pay_stub"),
    [documents.data],
  );

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && change) {
      setType(change.type);
      setCurrency(change.currency);
      setEffectiveDate(change.effectiveDate);
      setAmount(change.amountCents !== null ? centsToDollars(change.amountCents) : "");
      setCommissionPercent(
        change.commissionBasisPoints !== null
          ? basisPointsToCommissionPercent(change.commissionBasisPoints)
          : "",
      );
      setNotes(change.notes ?? "");
      setDiscussionId(change.discussionId ?? "none");
      setDocumentMode(change.documentId ? "existing" : "none");
      setExistingDocumentId(change.documentId ?? "none");
      setDocumentFile(null);
      setDocumentTitle("");
      setDocumentTitleTouched(false);
      setDocumentType("salary_letter");
      return;
    }

    setType("annual_salary");
    setCurrency("CAD");
    setEffectiveDate(defaultEffectiveDate ?? "");
    setAmount("");
    setCommissionPercent("");
    setNotes("");
    setDiscussionId("none");
    setDocumentMode("none");
    setExistingDocumentId("none");
    setDocumentFile(null);
    setDocumentTitle("");
    setDocumentTitleTouched(false);
    setDocumentType("salary_letter");
  }, [change, defaultEffectiveDate, mode, open]);

  useEffect(() => {
    if (!documentFile || documentTitleTouched) return;
    setDocumentTitle(titleFromFilename(documentFile.name));
  }, [documentFile, documentTitleTouched]);

  const createChange = api.compensationChanges.create.useMutation();
  const updateChange = api.compensationChanges.update.useMutation();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!effectiveDate) {
      toast.error("Enter an effective date.");
      return;
    }

    const amountCents = type === "commission" ? null : dollarsToCents(amount);
    const commissionBasisPoints =
      type === "commission" ? commissionPercentToBasisPoints(commissionPercent) : null;

    if (type === "commission" && commissionBasisPoints === null) {
      toast.error("Enter a commission percentage between 0 and 100.");
      return;
    }
    if (type !== "commission" && amountCents === null) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (documentMode === "upload" && !documentFile) {
      toast.error("Choose a file to upload.");
      return;
    }

    const payload = {
      type,
      currency,
      effectiveDate,
      amountCents,
      commissionBasisPoints,
      notes: notes.trim() || null,
      discussionId: discussionId === "none" ? null : discussionId,
      documentId: null as string | null,
    };

    setSubmitting(true);
    try {
      if (documentMode === "existing" && existingDocumentId !== "none") {
        payload.documentId = existingDocumentId;
      }

      if (documentMode === "upload" && documentFile) {
        const uploaded = (await uploadEmploymentDocument({
          employmentId,
          file: documentFile,
          type: documentType,
          title: documentTitle.trim() || undefined,
          documentDate: effectiveDate,
          discussionId: payload.discussionId,
        })) as Document;
        payload.documentId = uploaded.id;
      }

      if (mode === "edit" && change) {
        await updateChange.mutateAsync({ id: change.id, ...payload });
      } else {
        await createChange.mutateAsync({ employmentId, ...payload });
      }

      await Promise.all([
        utils.compensationChanges.listByEmployment.invalidate({ employmentId }),
        utils.compensationChanges.getCurrentByEmployment.invalidate({ employmentId }),
        utils.employments.list.invalidate(),
        utils.documents.listByEmployment.invalidate({ employmentId }),
      ]);

      toast.success(mode === "edit" ? "Compensation change updated." : "Compensation change added.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save compensation change.");
    } finally {
      setSubmitting(false);
    }
  }

  const pending = submitting || createChange.isPending || updateChange.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>
              {mode === "edit" ? "Edit compensation change" : "Add compensation change"}
            </SheetTitle>
            <SheetDescription>
              Record the agreed rate that took effect on a date. This is separate from paycheck
              amounts.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Compensation type</Label>
                <Select value={type} onValueChange={(value) => setType(value as CompensationType)}>
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
                  value={currency}
                  onValueChange={(value) => setCurrency(value as CompensationCurrency)}
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
              <Label htmlFor="compensation-effective-date">Effective date</Label>
              <Input
                id="compensation-effective-date"
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                required
              />
            </div>

            {type === "commission" ? (
              <div className="space-y-2">
                <Label htmlFor="compensation-commission">Commission percentage</Label>
                <Input
                  id="compensation-commission"
                  inputMode="decimal"
                  value={commissionPercent}
                  onChange={(event) => setCommissionPercent(event.target.value)}
                  placeholder="60"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="compensation-amount">
                  {type === "annual_salary" ? "Annual salary" : "Hourly rate"}
                </Label>
                <Input
                  id="compensation-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder={type === "annual_salary" ? "85000" : "45.00"}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="compensation-notes">Reason or notes</Label>
              <Textarea
                id="compensation-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="Annual review increase"
              />
            </div>

            <div className="space-y-2">
              <Label>Related discussion</Label>
              <Select value={discussionId} onValueChange={setDiscussionId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {discussions.data?.map((discussion) => (
                    <SelectItem key={discussion.id} value={discussion.id}>
                      {discussion.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label>Supporting document</Label>
                <Select
                  value={documentMode}
                  onValueChange={(value) => setDocumentMode(value as typeof documentMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No document</SelectItem>
                    <SelectItem value="existing">Link existing document</SelectItem>
                    <SelectItem value="upload">Upload new document</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {documentMode === "existing" ? (
                <div className="space-y-2">
                  <Label>Document</Label>
                  <Select value={existingDocumentId} onValueChange={setExistingDocumentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose document" />
                    </SelectTrigger>
                    <SelectContent>
                      {supportingDocuments.map((document) => (
                        <SelectItem key={document.id} value={document.id}>
                          {document.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {documentMode === "upload" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="compensation-document-file">File</Label>
                    <Input
                      id="compensation-document-file"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.eml"
                      onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Document type</Label>
                    <Select
                      value={documentType}
                      onValueChange={(value) => setDocumentType(value as typeof documentType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes
                          .filter((item) => item !== "pay_stub")
                          .map((item) => (
                            <SelectItem key={item} value={item}>
                              {documentTypeLabels[item]}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compensation-document-title">Title</Label>
                    <Input
                      id="compensation-document-title"
                      value={documentTitle}
                      onChange={(event) => {
                        setDocumentTitle(event.target.value);
                        setDocumentTitleTouched(true);
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Add change"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
