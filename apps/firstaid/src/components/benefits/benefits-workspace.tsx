"use client";

import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

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
import {
  benefitCoverageScopeLabels,
  type BenefitCoverageScope,
} from "~/lib/benefits";
import { formatCents, parseDollarsToCents } from "~/lib/money";
import { cn } from "~/lib/utils";
import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";

type BenefitsOverview = RouterOutputs["benefits"]["overview"];
type BenefitRow = BenefitsOverview["plans"][number]["benefits"][number];
type Person = BenefitsOverview["people"][number];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function nullableText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function BenefitsWorkspace({ initialOverview }: { initialOverview: BenefitsOverview }) {
  const [selectedYear, setSelectedYear] = useState(initialOverview.selectedYear);
  const overview = api.benefits.overview.useQuery(
    { year: selectedYear },
    { initialData: selectedYear === initialOverview.selectedYear ? initialOverview : undefined },
  );
  const data = overview.data;

  if (!data) return null;

  const yearOptions = data.years.length > 0
    ? data.years
    : [data.selectedYear];

  return (
    <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Coverage planning</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">Benefits</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Track the benefits worth watching during the year. Only add coverage you actively use for planning.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(selectedYear)}
              onValueChange={(value) => setSelectedYear(Number(value))}
            >
              <SelectTrigger className="w-36" aria-label="Benefit year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <InsurancePlanDialog
              defaultYear={selectedYear}
              onCreated={() => overview.refetch()}
            />
          </div>
        </div>

        {data.plans.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldCheck className="mb-3 size-6 text-muted-foreground" />
              <p className="font-medium">No insurance plans for {selectedYear}</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Add the plans and benefits you want visible while planning care for the year.
              </p>
            </CardContent>
          </Card>
        ) : (
          data.plans.map((plan) => (
            <section key={plan.id} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.year} coverage</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <BenefitDialog
                    insurancePlanId={plan.id}
                    people={data.people}
                    onSaved={() => overview.refetch()}
                  />
                  <InsurancePlanDialog
                    plan={plan}
                    onSaved={() => overview.refetch()}
                  />
                  <DeletePlanButton
                    plan={plan}
                    onDeleted={() => overview.refetch()}
                  />
                </div>
              </div>

              {plan.benefits.length === 0 ? (
                <Card className="border-dashed shadow-none">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No benefits added yet. Add the dollar pools you want to track.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {plan.benefits.map((benefit) => (
                    <BenefitCard
                      key={benefit.id}
                      benefit={benefit}
                      people={data.people}
                      insurancePlanId={plan.id}
                      onSaved={() => overview.refetch()}
                    />
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </div>
    </main>
  );
}

function BenefitCard({
  benefit,
  people,
  insurancePlanId,
  onSaved,
}: {
  benefit: BenefitRow;
  people: Person[];
  insurancePlanId: string;
  onSaved: () => void;
}) {
  const deleteBenefit = api.benefits.deleteBenefit.useMutation();
  const person = benefit.personId
    ? people.find((candidate) => candidate.id === benefit.personId)
    : null;
  const usedPercent = benefit.annualLimitCents > 0
    ? Math.min((benefit.usedCents / benefit.annualLimitCents) * 100, 100)
    : 0;

  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold">{benefit.name}</h4>
              <Badge variant="outline">
                {benefit.coverageScope === "household"
                  ? benefitCoverageScopeLabels.household
                  : person?.displayName ?? benefitCoverageScopeLabels.person}
              </Badge>
            </div>
            <p className="mt-2 text-sm">
              <span className="font-medium">{formatCents(benefit.remainingCents)} remaining</span>
              <span className="text-muted-foreground"> · resets {benefit.resetDate}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCents(benefit.usedCents)} used of {formatCents(benefit.annualLimitCents)}
              {benefit.pendingCents > 0 ? ` · ${formatCents(benefit.pendingCents)} pending` : ""}
            </p>
            {benefit.overLimitCents > 0 ? (
              <p className="mt-1 text-sm text-amber-700">
                {formatCents(benefit.overLimitCents)} over the annual limit
              </p>
            ) : null}
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  benefit.overLimitCents > 0 ? "bg-amber-500" : "bg-primary/70",
                )}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <BenefitDialog
              benefit={benefit}
              insurancePlanId={insurancePlanId}
              people={people}
              onSaved={onSaved}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">
                  <Trash2 />Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{benefit.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Benefits with claims cannot be deleted. This removes the benefit from planning only when no claims reference it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={async () => {
                      await deleteBenefit.mutateAsync({ id: benefit.id });
                      onSaved();
                    }}
                  >
                    Delete benefit
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <Button asChild variant="link" className="h-auto w-fit p-0 text-sm">
          <Link href={`/benefits/${benefit.id}`}>View contributing claims</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function InsurancePlanDialog({
  plan,
  defaultYear,
  onCreated,
  onSaved,
}: {
  plan?: BenefitsOverview["plans"][number];
  defaultYear?: number;
  onCreated?: () => void;
  onSaved?: () => void;
}) {
  const createPlan = api.benefits.createPlan.useMutation();
  const updatePlan = api.benefits.updatePlan.useMutation();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const fields: RouterInputs["benefits"]["createPlan"] = {
      name: String(form.get("name") ?? ""),
      year: Number(form.get("year")),
      notes: nullableText(form.get("notes")),
    };

    try {
      if (plan) await updatePlan.mutateAsync({ id: plan.id, ...fields });
      else await createPlan.mutateAsync(fields);
      setOpen(false);
      if (plan) onSaved?.();
      else onCreated?.();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {plan ? (
          <Button size="sm" variant="outline"><Pencil />Edit plan</Button>
        ) : (
          <Button size="sm" variant="outline"><Plus />Add plan</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plan ? "Edit insurance plan" : "Add insurance plan"}</DialogTitle>
          <DialogDescription>
            Group benefits from one coverage source for a calendar year.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="plan-name">Plan name</Label>
            <Input id="plan-name" name="name" defaultValue={plan?.name ?? ""} required maxLength={160} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-year">Year</Label>
            <Input
              id="plan-year"
              name="year"
              type="number"
              min={1900}
              max={9999}
              defaultValue={plan?.year ?? defaultYear ?? new Date().getFullYear()}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="plan-notes" name="notes" defaultValue={plan?.notes ?? ""} rows={3} maxLength={2000} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={createPlan.isPending || updatePlan.isPending}>
              {createPlan.isPending || updatePlan.isPending ? "Saving…" : plan ? "Save changes" : "Add plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BenefitDialog({
  benefit,
  insurancePlanId,
  people,
  onSaved,
}: {
  benefit?: BenefitRow;
  insurancePlanId: string;
  people: Person[];
  onSaved: () => void;
}) {
  const createBenefit = api.benefits.createBenefit.useMutation();
  const updateBenefit = api.benefits.updateBenefit.useMutation();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [coverageScope, setCoverageScope] = useState<BenefitCoverageScope>(
    benefit?.coverageScope ?? "person",
  );
  const [personId, setPersonId] = useState(benefit?.personId ?? people[0]?.id ?? "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const annualLimit = parseDollarsToCents(String(form.get("annualLimit") ?? ""));
    const openingUsed = parseDollarsToCents(String(form.get("openingUsed") ?? "0"));
    if (annualLimit === null) {
      setError("Enter a valid annual limit.");
      return;
    }
    if (openingUsed === null) {
      setError("Enter a valid opening used amount.");
      return;
    }

    const fields: RouterInputs["benefits"]["createBenefit"] = {
      insurancePlanId,
      name: String(form.get("name") ?? ""),
      coverageScope,
      personId: coverageScope === "person" ? personId : null,
      annualLimitCents: annualLimit,
      openingUsedCents: openingUsed,
      notes: nullableText(form.get("notes")),
    };

    try {
      if (benefit) await updateBenefit.mutateAsync({ id: benefit.id, ...fields });
      else await createBenefit.mutateAsync(fields);
      setOpen(false);
      onSaved();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {benefit ? (
          <Button size="sm" variant="outline"><Pencil />Edit</Button>
        ) : (
          <Button size="sm"><Plus />Add benefit</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{benefit ? "Edit benefit" : "Add benefit"}</DialogTitle>
          <DialogDescription>
            Track a dollar pool for planning. Opening usage covers spending that happened outside First Aid.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="benefit-name">Benefit name</Label>
            <Input id="benefit-name" name="name" defaultValue={benefit?.name ?? ""} required maxLength={160} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="benefit-scope">Coverage</Label>
            <Select value={coverageScope} onValueChange={(value) => setCoverageScope(value as BenefitCoverageScope)}>
              <SelectTrigger id="benefit-scope"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="person">One household member</SelectItem>
                <SelectItem value="household">Shared by household</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {coverageScope === "person" ? (
            <div className="space-y-2">
              <Label htmlFor="benefit-person">Household member</Label>
              <Select value={personId} onValueChange={setPersonId}>
                <SelectTrigger id="benefit-person"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>{person.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="benefit-limit">Annual limit</Label>
              <Input
                id="benefit-limit"
                name="annualLimit"
                inputMode="decimal"
                defaultValue={benefit ? formatCents(benefit.annualLimitCents).replace("$", "") : ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="benefit-opening">Opening used</Label>
              <Input
                id="benefit-opening"
                name="openingUsed"
                inputMode="decimal"
                defaultValue={
                  benefit && benefit.openingUsedCents > 0
                    ? formatCents(benefit.openingUsedCents).replace("$", "")
                    : "0"
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="benefit-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="benefit-notes" name="notes" defaultValue={benefit?.notes ?? ""} rows={3} maxLength={2000} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={createBenefit.isPending || updateBenefit.isPending}>
              {createBenefit.isPending || updateBenefit.isPending ? "Saving…" : benefit ? "Save changes" : "Add benefit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeletePlanButton({
  plan,
  onDeleted,
}: {
  plan: BenefitsOverview["plans"][number];
  onDeleted: () => void;
}) {
  const deletePlan = api.benefits.deletePlan.useMutation();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">
          <Trash2 />Delete plan
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{plan.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Plans with claims on their benefits cannot be deleted. Otherwise this removes the plan and its benefits.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={async () => {
              await deletePlan.mutateAsync({ id: plan.id });
              onDeleted();
            }}
          >
            Delete plan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
