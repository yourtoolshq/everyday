"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Download, FileText, Pencil, Plus, Trash2 } from "lucide-react";

import type { ClaimStatus } from "~/lib/benefits";
import type { RouterInputs, RouterOutputs } from "~/trpc/react";
import { UploadDocumentDialog } from "~/components/documents/document-manager";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { claimStatuses, claimStatusLabels } from "~/lib/benefits";
import { documentTypeLabels } from "~/lib/documents";
import { formatCents, parseDollarsToCents } from "~/lib/money";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

type VisitDetail = NonNullable<RouterOutputs["visits"]["detail"]>;
type VisitClaim = VisitDetail["claims"][number];
type VisitDocument = VisitDetail["documents"][number];

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function nullableText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

const statusStyles: Record<ClaimStatus, string> = {
  submitted: "border-amber-200 bg-amber-50 text-amber-800",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-800",
  denied: "border-stone-200 bg-stone-50 text-stone-700",
};

export function VisitFinancials({
  visitId,
  costCents,
  financials,
  claims,
  documents,
}: {
  visitId: string;
  costCents: number | null;
  financials: VisitDetail["financials"];
  claims: VisitClaim[];
  documents: VisitDocument[];
}) {
  const utils = api.useUtils();

  async function invalidate() {
    await Promise.all([
      utils.visits.detail.invalidate({ id: visitId }),
      utils.benefits.overview.invalidate(),
      utils.planning.overview.invalidate(),
    ]);
  }

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Cost and coverage</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Record what the visit cost and how benefits reimbursed it.
            </p>
          </div>
          {costCents !== null ? (
            <ClaimDialog visitId={visitId} onSaved={invalidate} />
          ) : null}
        </div>

        {costCents === null ? (
          <p className="text-muted-foreground text-sm">
            Add a visit cost to record claims and calculate out-of-pocket
            amounts.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Detail label="Visit cost" value={formatCents(costCents)} />
            <Detail
              label="Paid by benefits"
              value={formatCents(financials?.reimbursedCents ?? 0)}
            />
            <Detail
              label="Pending claims"
              value={formatCents(financials?.pendingCents ?? 0)}
            />
            <Detail
              label="Out of pocket"
              value={formatCents(financials?.outOfPocketCents ?? 0)}
            />
          </div>
        )}

        {claims.length > 0 ? (
          <div className="space-y-3">
            {claims.map((claim) => {
              const claimDocuments = documents.filter(
                (document) => document.claimId === claim.id,
              );
              return (
                <div key={claim.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{claim.benefitName}</p>
                        <Badge
                          variant="outline"
                          className={cn(statusStyles[claim.status])}
                        >
                          {claimStatusLabels[claim.status]}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {formatCents(claim.amountCents)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <UploadDocumentDialog
                        visitId={visitId}
                        claims={claims}
                        defaultClaimId={claim.id}
                        trigger={
                          <Button size="sm" variant="outline">
                            <FileText />
                            Add paperwork
                          </Button>
                        }
                      />
                      <ClaimDialog
                        visitId={visitId}
                        claim={claim}
                        onSaved={invalidate}
                      />
                      <DeleteClaimButton
                        claimId={claim.id}
                        onDeleted={invalidate}
                      />
                    </div>
                  </div>
                  {claimDocuments.length > 0 ? (
                    <div className="mt-4 space-y-2 border-t pt-4">
                      {claimDocuments.map((document) => (
                        <div
                          key={document.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium">{document.title}</p>
                            <p className="text-muted-foreground">
                              {documentTypeLabels[document.type]}
                            </p>
                          </div>
                          <Button asChild size="sm" variant="ghost">
                            <a
                              href={`/api/documents/${document.id}/file`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Download />
                              Open
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : costCents !== null ? (
          <p className="text-muted-foreground text-sm">
            No claims recorded yet.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ClaimDialog({
  visitId,
  claim,
  onSaved,
}: {
  visitId: string;
  claim?: VisitClaim;
  onSaved: () => void;
}) {
  const createClaim = api.visits.createClaim.useMutation();
  const updateClaim = api.visits.updateClaim.useMutation();
  const eligibleBenefits = api.visits.eligibleBenefits.useQuery({
    id: visitId,
  });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [benefitId, setBenefitId] = useState(claim?.benefitId ?? "");
  const [status, setStatus] = useState<ClaimStatus>(claim?.status ?? "paid");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const amount = parseDollarsToCents(String(form.get("amount") ?? ""));
    if (amount === null || amount <= 0) {
      setError("Enter a valid claim amount.");
      return;
    }
    if (!benefitId) {
      setError("Choose a benefit.");
      return;
    }

    const fields: RouterInputs["visits"]["createClaim"] = {
      visitId,
      benefitId,
      status,
      amountCents: amount,
      notes: nullableText(form.get("notes")),
    };

    try {
      if (claim) await updateClaim.mutateAsync({ id: claim.id, ...fields });
      else await createClaim.mutateAsync(fields);
      setOpen(false);
      onSaved();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  const benefits = eligibleBenefits.data ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {claim ? (
          <Button size="sm" variant="outline">
            <Pencil />
            Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus />
            Add claim
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{claim ? "Edit claim" : "Add claim"}</DialogTitle>
          <DialogDescription>
            Choose the benefit and enter the final amount paid or expected.
          </DialogDescription>
        </DialogHeader>
        {benefits.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No eligible benefits for this visit&apos;s year and household
            member. Add benefits on the Benefits page first.
          </p>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="claim-benefit">Benefit</Label>
              <Select value={benefitId} onValueChange={setBenefitId}>
                <SelectTrigger id="claim-benefit">
                  <SelectValue placeholder="Choose a benefit" />
                </SelectTrigger>
                <SelectContent>
                  {benefits.map((benefit) => (
                    <SelectItem key={benefit.id} value={benefit.id}>
                      {benefit.name} · {formatCents(benefit.remainingCents)}{" "}
                      remaining
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-amount">Amount</Label>
              <Input
                id="claim-amount"
                name="amount"
                inputMode="decimal"
                defaultValue={
                  claim ? formatCents(claim.amountCents).replace("$", "") : ""
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as ClaimStatus)}
              >
                <SelectTrigger id="claim-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {claimStatuses.map((value) => (
                    <SelectItem key={value} value={value}>
                      {claimStatusLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-notes">
                Notes{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="claim-notes"
                name="notes"
                defaultValue={claim?.notes ?? ""}
                rows={3}
                maxLength={2000}
              />
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <DialogFooter>
              <Button
                type="submit"
                disabled={createClaim.isPending || updateClaim.isPending}
              >
                {createClaim.isPending || updateClaim.isPending
                  ? "Saving…"
                  : claim
                    ? "Save changes"
                    : "Add claim"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeleteClaimButton({
  claimId,
  onDeleted,
}: {
  claimId: string;
  onDeleted: () => void;
}) {
  const deleteClaim = api.visits.deleteClaim.useMutation();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this claim?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the claim from the visit and updates benefit usage
            totals.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={async () => {
              await deleteClaim.mutateAsync({ id: claimId });
              onDeleted();
            }}
          >
            Delete claim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-sm font-medium">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}
