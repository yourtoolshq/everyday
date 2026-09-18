"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  canDeriveStatementPeriods,
  deriveAllUploadablePeriods,
  suggestDefaultPeriodKey,
} from "~/lib/expected-periods";
import { titleFromFilename } from "~/lib/documents";
import { uploadStatement } from "~/lib/upload-statement";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { api, type RouterOutputs } from "~/trpc/react";

type Account = RouterOutputs["accounts"]["list"][number];

type StatementUploadSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId?: string;
  periodKey?: string;
};

function accountSupportsStatements(account: Account) {
  return (
    account.statementFrequency !== "none" &&
    canDeriveStatementPeriods(
      {
        openedDate: account.openedDate,
        closedDate: account.closedDate,
        status: account.status,
      },
      account.statementFrequency,
    )
  );
}

export function StatementUploadSheet({
  open,
  onOpenChange,
  accountId: initialAccountId,
  periodKey: initialPeriodKey,
}: StatementUploadSheetProps) {
  const utils = api.useUtils();
  const accounts = api.accounts.list.useQuery();
  const statementDocuments = api.documents.statementDocumentsByAccount.useQuery();

  const uploadableAccounts = useMemo(
    () => (accounts.data ?? []).filter(accountSupportsStatements),
    [accounts.data],
  );

  const [accountId, setAccountId] = useState(initialAccountId ?? "");
  const [periodKey, setPeriodKey] = useState(initialPeriodKey ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  const selectedAccount = uploadableAccounts.find((account) => account.id === accountId);
  const uploadedPeriodKeys = useMemo(() => {
    return new Set(Object.keys(statementDocuments.data?.[accountId] ?? {}));
  }, [accountId, statementDocuments.data]);

  const uploadablePeriods = useMemo(() => {
    if (!selectedAccount) return [];
    return deriveAllUploadablePeriods(
      {
        openedDate: selectedAccount.openedDate,
        closedDate: selectedAccount.closedDate,
        status: selectedAccount.status,
      },
      selectedAccount.statementFrequency,
    );
  }, [selectedAccount]);

  const periodsByYear = useMemo(() => {
    const grouped = new Map<number, typeof uploadablePeriods>();
    for (const period of uploadablePeriods) {
      const current = grouped.get(period.year) ?? [];
      current.push(period);
      grouped.set(period.year, current);
    }
    return [...grouped.entries()].sort(([left], [right]) => right - left);
  }, [uploadablePeriods]);

  useEffect(() => {
    if (!open) return;
    setAccountId(initialAccountId ?? "");
    setPeriodKey(initialPeriodKey ?? "");
    setFile(null);
    setTitle("");
    setNotes("");
  }, [initialAccountId, initialPeriodKey, open]);

  useEffect(() => {
    if (!open || initialAccountId) return;
    if (!accountId && uploadableAccounts[0]) {
      setAccountId(uploadableAccounts[0].id);
    }
  }, [accountId, initialAccountId, open, uploadableAccounts]);

  useEffect(() => {
    if (!open || !selectedAccount) return;
    if (initialPeriodKey && uploadablePeriods.some((period) => period.key === initialPeriodKey)) {
      setPeriodKey(initialPeriodKey);
      return;
    }
    const suggested = suggestDefaultPeriodKey(uploadablePeriods, uploadedPeriodKeys);
    setPeriodKey(suggested ?? "");
  }, [
    initialPeriodKey,
    open,
    selectedAccount,
    uploadablePeriods,
    uploadedPeriodKeys,
  ]);

  useEffect(() => {
    if (!file) return;
    setTitle(titleFromFilename(file.name));
  }, [file]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountId) {
      toast.error("Choose an account.");
      return;
    }
    if (!periodKey) {
      toast.error("Choose a statement period.");
      return;
    }
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    if (uploadedPeriodKeys.has(periodKey)) {
      toast.error("This account already has a statement for that period.");
      return;
    }

    setUploading(true);
    try {
      await uploadStatement({
        accountId,
        file,
        periodKey,
        title,
        notes,
      });
      await Promise.all([
        utils.documents.overview.invalidate(),
        utils.documents.statementDocumentsByAccount.invalidate(),
      ]);
      toast.success("Statement uploaded.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const lockAccount = Boolean(initialAccountId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>Upload statement</SheetTitle>
            <SheetDescription>
              Link a PDF or image to an expected statement period for an account.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="statement-file">File</Label>
              <Input
                id="statement-file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,.pdf,.jpg,.jpeg,.png,.webp,.heic"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
              />
              <p className="text-xs text-muted-foreground">PDF, JPEG, PNG, WebP, or HEIC up to 25 MB.</p>
            </div>

            <div className="space-y-2">
              <Label>Account</Label>
              <Select
                value={accountId}
                onValueChange={setAccountId}
                disabled={lockAccount || uploadableAccounts.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose account" />
                </SelectTrigger>
                <SelectContent>
                  {uploadableAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.institutionName} · {account.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {uploadableAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add an account with an opened date and statement schedule before uploading.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Statement period</Label>
              <Select
                value={periodKey}
                onValueChange={setPeriodKey}
                disabled={!selectedAccount || uploadablePeriods.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose period" />
                </SelectTrigger>
                <SelectContent>
                  {periodsByYear.map(([year, periods]) => (
                    <SelectGroup key={year}>
                      <SelectLabel>{year}</SelectLabel>
                      {periods.map((period) => (
                        <SelectItem
                          key={period.key}
                          value={period.key}
                          disabled={uploadedPeriodKeys.has(period.key)}
                        >
                          {period.label}
                          {uploadedPeriodKeys.has(period.key) ? " · Uploaded" : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="statement-title">Title</Label>
              <Input
                id="statement-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="statement-notes">Notes</Label>
              <Textarea
                id="statement-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
              />
            </div>
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={uploading || uploadableAccounts.length === 0 || !selectedAccount}
            >
              {uploading ? "Uploading…" : "Save statement"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
