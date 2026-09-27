"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { documentAccept } from "~/lib/documents";
import { suggestPayStubTitle } from "~/lib/pay-stubs";
import { FileDropzone, useUpload } from "~/lib/uploads";
import { api } from "~/trpc/react";

type PayStubUploadSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paycheckId: string | null;
  employmentId: string;
  employerName: string;
  personName: string;
  paycheck?: {
    periodStartDate: string;
    periodEndDate: string;
    payDate: string;
  } | null;
  onSuccess?: () => void;
};

export function PayStubUploadSheet({
  open,
  onOpenChange,
  paycheckId,
  employmentId,
  employerName,
  personName,
  paycheck,
  onSuccess,
}: PayStubUploadSheetProps) {
  const utils = api.useUtils();
  const attachStub = api.paychecks.attachStub.useMutation();
  const fileUpload = useUpload("document");
  const resetUpload = fileUpload.reset;
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    resetUpload();
    setTitleTouched(false);
    if (paycheck) {
      setTitle(
        suggestPayStubTitle({
          employerName,
          personName,
          periodStartDate: paycheck.periodStartDate,
          periodEndDate: paycheck.periodEndDate,
          payDate: paycheck.payDate,
        }),
      );
      return;
    }
    setTitle("");
  }, [open, paycheck, employerName, personName, resetUpload]);

  useEffect(() => {
    if (!open || titleTouched || !paycheck) return;
    setTitle(
      suggestPayStubTitle({
        employerName,
        personName,
        periodStartDate: paycheck.periodStartDate,
        periodEndDate: paycheck.periodEndDate,
        payDate: paycheck.payDate,
      }),
    );
  }, [open, paycheck, employerName, personName, titleTouched]);

  async function submitUpload() {
    const uploaded = fileUpload.file;
    if (!paycheckId || !uploaded) {
      toast.error("Choose a file to upload.");
      return;
    }

    setUploading(true);
    try {
      await attachStub.mutateAsync({
        paycheckId,
        file: uploaded.token,
        title,
      });
      await Promise.all([
        utils.paychecks.listByEmployment.invalidate({ employmentId }),
        utils.paychecks.periodCompleteness.invalidate({ employmentId }),
        utils.paychecks.listForReview.invalidate(),
        utils.documents.listByEmployment.invalidate({ employmentId }),
      ]);
      toast.success("Pay stub attached.");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Attach pay stub</SheetTitle>
          <SheetDescription>
            Upload the original PDF or image for this paycheck.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col gap-4 px-4 pb-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitUpload();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="pay-stub-file">File</Label>
            <FileDropzone
              id="pay-stub-file"
              upload={fileUpload}
              accept={documentAccept}
            />
            <p className="text-muted-foreground text-xs">
              PDF, JPEG, PNG, WebP, HEIC, or EML up to 25 MB.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-stub-title">Title</Label>
            <Input
              id="pay-stub-title"
              value={title}
              onChange={(event) => {
                setTitleTouched(true);
                setTitle(event.target.value);
              }}
              placeholder="Pay stub"
            />
            <p className="text-muted-foreground text-xs">
              Suggested from the pay period and employer. You can edit it before
              uploading.
            </p>
          </div>

          <SheetFooter className="px-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                uploading || !paycheckId || fileUpload.status === "uploading"
              }
            >
              {uploading ? "Uploading…" : "Attach pay stub"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
