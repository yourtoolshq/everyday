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
import { suggestPayStubTitle } from "~/lib/pay-stubs";
import { uploadPayStub } from "~/lib/upload-pay-stub";
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
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
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
  }, [open, paycheck, employerName, personName]);

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
    if (!paycheckId || !file) {
      toast.error("Choose a file to upload.");
      return;
    }

    setUploading(true);
    try {
      await uploadPayStub(paycheckId, file, title);
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
            <Input
              id="pay-stub-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
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
            <Button type="submit" disabled={uploading || !paycheckId}>
              {uploading ? "Uploading…" : "Attach pay stub"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
