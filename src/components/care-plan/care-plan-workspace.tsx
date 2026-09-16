"use client";

import {
  CalendarDays,
  CalendarPlus,
  Clock3,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
  careCadenceLabels,
  careCadences,
  careCategories,
  careCategoryLabels,
  careSourceLabels,
  careSources,
  careStatusLabels,
  careStatuses,
  dateMeaningLabels,
  dateMeanings,
  intervalUnitLabels,
  intervalUnits,
  monthLabels,
  seasonLabels,
  seasons,
  timingKindLabels,
  timingKinds,
  type CareCadence,
  type CareCategory,
  type CareSource,
  type CareStatus,
  type TimingKind,
} from "~/lib/care-planning";
import { cn } from "~/lib/utils";
import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";

type Overview = RouterOutputs["planning"]["overview"];
type CareItem = Overview["items"][number];
type Person = Overview["people"][number];

const statusStyles: Record<CareStatus, string> = {
  to_consider: "border-amber-200 bg-amber-50 text-amber-800",
  planned: "border-sky-200 bg-sky-50 text-sky-800",
  scheduled: "border-violet-200 bg-violet-50 text-violet-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  skipped: "border-slate-200 bg-slate-50 text-slate-700",
  not_due: "border-stone-200 bg-stone-50 text-stone-700",
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function nullableText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function formatTiming(item: CareItem) {
  if (item.timingKind === "date" && item.targetDate) {
    const date = new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${item.targetDate}T00:00:00Z`));
    return item.dateMeaning === "not_before" ? `Not before ${date}` : date;
  }
  if (item.timingKind === "month" && item.targetMonth) {
    return monthLabels[item.targetMonth - 1];
  }
  if (item.timingKind === "season" && item.targetSeason) {
    return seasonLabels[item.targetSeason];
  }
  return "No target";
}

function formatCadence(item: CareItem) {
  if (item.cadence === "recurring_interval" && item.intervalCount && item.intervalUnit) {
    const unit = item.intervalCount === 1 ? item.intervalUnit.slice(0, -1) : item.intervalUnit;
    return `Every ${item.intervalCount} ${unit}`;
  }
  return careCadenceLabels[item.cadence];
}

export function CarePlanWorkspace({ initialOverview }: { initialOverview: Overview }) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(
    initialOverview.selectedPlan?.id,
  );
  const overview = api.planning.overview.useQuery(
    selectedPlanId ? { planId: selectedPlanId } : undefined,
    {
      initialData:
        selectedPlanId === initialOverview.selectedPlan?.id
          ? initialOverview
          : undefined,
    },
  );
  const data = overview.data;

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Loading care plan…
      </main>
    );
  }

  if (data.people.length === 0) {
    return <FirstPersonSetup />;
  }

  if (data.plans.length === 0 || !data.selectedPlan) {
    return <FirstPlanSetup people={data.people} onCreated={setSelectedPlanId} />;
  }

  return (
    <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Healthcare year</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">
              {data.selectedPlan.year} care plan
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Keep the healthcare your household wants to consider in one place, then update it as the year unfolds.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <HouseholdDialog people={data.people} />
            <CareItemDialog planId={data.selectedPlan.id} people={data.people} />
          </div>
        </div>

        <PlanToolbar
          overview={data}
          selectedPlanId={data.selectedPlan.id}
          onSelect={setSelectedPlanId}
        />

        <div className="grid gap-5">
          {data.people.map((person) => {
            const items = data.items.filter((item) => item.personId === person.id);
            return (
              <PersonSection
                key={person.id}
                person={person}
                items={items}
                people={data.people}
                planId={data.selectedPlan!.id}
              />
            );
          })}
        </div>
      </div>
    </main>
  );
}

function FirstPersonSetup() {
  const utils = api.useUtils();
  const createPerson = api.planning.createPerson.useMutation();
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      await createPerson.mutateAsync({ displayName: String(form.get("displayName") ?? "") });
      await utils.planning.overview.invalidate();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-lg shadow-sm">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users aria-hidden="true" className="size-5" />
          </div>
          <CardTitle className="text-2xl">
            <h2>Who are you planning care for?</h2>
          </CardTitle>
          <CardDescription>
            Start with one household member. You can add everyone else from the care plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="first-person-name">Display name</Label>
              <Input id="first-person-name" name="displayName" placeholder="e.g. Alex" autoFocus required maxLength={80} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" disabled={createPerson.isPending}>
              {createPerson.isPending ? "Adding…" : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function FirstPlanSetup({ people, onCreated }: { people: Person[]; onCreated: (id: string) => void }) {
  const utils = api.useUtils();
  const createPlan = api.planning.createPlan.useMutation();
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      const plan = await createPlan.mutateAsync({ year: Number(form.get("year")) });
      onCreated(plan.id);
      await utils.planning.overview.invalidate();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-lg shadow-sm">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarPlus aria-hidden="true" className="size-5" />
          </div>
          <CardTitle className="text-2xl">
            <h2>Create your healthcare year</h2>
          </CardTitle>
          <CardDescription>
            Your plan will organize care for {people[0]?.displayName} and any other household members you add.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="first-plan-year">Plan year</Label>
              <Input id="first-plan-year" name="year" type="number" min={1900} max={9999} defaultValue={new Date().getFullYear()} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" disabled={createPlan.isPending}>
              {createPlan.isPending ? "Creating…" : "Create care plan"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function PlanToolbar({
  overview,
  selectedPlanId,
  onSelect,
}: {
  overview: Overview;
  selectedPlanId: string;
  onSelect: (id: string | undefined) => void;
}) {
  const utils = api.useUtils();
  const updatePlan = api.planning.updatePlan.useMutation();
  const deletePlan = api.planning.deletePlan.useMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string>();

  async function changeYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      await updatePlan.mutateAsync({ id: selectedPlanId, year: Number(form.get("year")) });
      await utils.planning.overview.invalidate();
      setEditOpen(false);
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
          <Label htmlFor="plan-year-select" className="sr-only">Care plan year</Label>
          <Select value={selectedPlanId} onValueChange={onSelect}>
            <SelectTrigger id="plan-year-select" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {overview.plans.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.year}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <PlanYearDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onSelect} />
          <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); setError(undefined); }}>
            <DialogTrigger asChild><Button variant="outline" size="sm"><Pencil />Edit year</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Edit plan year</DialogTitle><DialogDescription>Each year can have one household care plan.</DialogDescription></DialogHeader>
              <form onSubmit={changeYear} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="edit-plan-year">Plan year</Label><Input id="edit-plan-year" name="year" type="number" min={1900} max={9999} defaultValue={overview.selectedPlan?.year} required /></div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <DialogFooter><Button type="submit" disabled={updatePlan.isPending}>{updatePlan.isPending ? "Saving…" : "Save year"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 />Delete plan</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete the {overview.selectedPlan?.year} care plan?</AlertDialogTitle><AlertDialogDescription>This permanently deletes the plan and all of its care items. Household members will be kept.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={async () => { await deletePlan.mutateAsync({ id: selectedPlanId }); onSelect(undefined); await utils.planning.overview.invalidate(); }}>Delete plan</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanYearDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (id: string) => void }) {
  const utils = api.useUtils();
  const createPlan = api.planning.createPlan.useMutation();
  const [error, setError] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(undefined);
    try {
      const form = new FormData(event.currentTarget);
      const plan = await createPlan.mutateAsync({ year: Number(form.get("year")) });
      onCreated(plan.id); await utils.planning.overview.invalidate(); onOpenChange(false);
    } catch (caught) { setError(getErrorMessage(caught)); }
  }
  return (
    <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); setError(undefined); }}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><Plus />New year</Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>Create another care plan</DialogTitle><DialogDescription>Add a household plan for a different year.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="new-plan-year">Plan year</Label><Input id="new-plan-year" name="year" type="number" min={1900} max={9999} defaultValue={new Date().getFullYear() + 1} required /></div>{error && <p className="text-sm text-destructive">{error}</p>}<DialogFooter><Button disabled={createPlan.isPending}>{createPlan.isPending ? "Creating…" : "Create plan"}</Button></DialogFooter></form>
      </DialogContent>
    </Dialog>
  );
}

function PersonSection({ person, items, people, planId }: { person: Person; items: CareItem[]; people: Person[]; planId: string }) {
  return (
    <section aria-labelledby={`person-${person.id}`}>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{person.displayName.slice(0, 1).toUpperCase()}</div>
        <div><h3 id={`person-${person.id}`} className="font-semibold">{person.displayName}</h3><p className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? "care item" : "care items"}</p></div>
        <div className="ml-auto"><CareItemDialog planId={planId} people={people} defaultPersonId={person.id} compact /></div>
      </div>
      {items.length === 0 ? (
        <Card className="border-dashed bg-card/60 shadow-none"><CardContent className="flex flex-col items-center gap-3 py-9 text-center"><Clock3 className="size-6 text-muted-foreground" aria-hidden="true" /><div><p className="font-medium">Nothing planned yet</p><p className="text-sm text-muted-foreground">Add something {person.displayName} should consider this year.</p></div><CareItemDialog planId={planId} people={people} defaultPersonId={person.id} /></CardContent></Card>
      ) : (
        <div className="grid gap-3">{items.map((item) => <CareItemCard key={item.id} item={item} people={people} planId={planId} />)}</div>
      )}
    </section>
  );
}

function CareItemCard({ item, people, planId }: { item: CareItem; people: Person[]; planId: string }) {
  const utils = api.useUtils();
  const statusMutation = api.planning.updateItemStatus.useMutation();
  const deleteMutation = api.planning.deleteItem.useMutation();
  const [editOpen, setEditOpen] = useState(false);
  return (
    <Card className="shadow-none transition-colors hover:border-primary/25">
      <CardContent className="p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold leading-tight">{item.title}</h4><Badge variant="outline">{careCategoryLabels[item.category]}</Badge></div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"><span>{formatTiming(item)}</span><span>{formatCadence(item)}</span><span>{careSourceLabels[item.source]}</span></div>
            {item.sourceDetail && <p className="mt-3 text-sm">{item.sourceDetail}</p>}
            {item.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.notes}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Select value={item.status} disabled={statusMutation.isPending} onValueChange={async (status: CareStatus) => { await statusMutation.mutateAsync({ id: item.id, status }); await utils.planning.overview.invalidate(); }}>
              <SelectTrigger aria-label={`Status for ${item.title}`} className={cn("h-8 w-36 border text-xs font-medium", statusStyles[item.status])}><SelectValue /></SelectTrigger>
              <SelectContent>{careStatuses.map((status) => <SelectItem value={status} key={status}>{careStatusLabels[status]}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${item.title}`} onClick={() => setEditOpen(true)}><Pencil /></Button>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${item.title}`}><Trash2 /></Button></AlertDialogTrigger>
              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete “{item.title}”?</AlertDialogTitle><AlertDialogDescription>This permanently removes the care item from the plan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={async () => { await deleteMutation.mutateAsync({ id: item.id }); await utils.planning.overview.invalidate(); }}>Delete item</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
      <CareItemDialog planId={planId} people={people} item={item} open={editOpen} onOpenChange={setEditOpen} hideTrigger />
    </Card>
  );
}

function CareItemDialog({ planId, people, item, defaultPersonId, compact, open: controlledOpen, onOpenChange: controlledOnOpenChange, hideTrigger }: { planId: string; people: Person[]; item?: CareItem; defaultPersonId?: string; compact?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) {
  const utils = api.useUtils();
  const createItem = api.planning.createItem.useMutation();
  const updateItem = api.planning.updateItem.useMutation();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [error, setError] = useState<string>();
  const [personId, setPersonId] = useState(item?.personId ?? defaultPersonId ?? people[0]!.id);
  const [category, setCategory] = useState<CareCategory>(item?.category ?? "primary_care");
  const [status, setStatus] = useState<CareStatus>(item?.status ?? "to_consider");
  const [cadence, setCadence] = useState<CareCadence>(item?.cadence ?? "one_time");
  const [intervalUnit, setIntervalUnit] = useState<(typeof intervalUnits)[number]>(item?.intervalUnit ?? "months");
  const [timingKind, setTimingKind] = useState<TimingKind>(item?.timingKind ?? "none");
  const [dateMeaning, setDateMeaning] = useState<(typeof dateMeanings)[number]>(item?.dateMeaning ?? "target");
  const [targetMonth, setTargetMonth] = useState(String(item?.targetMonth ?? 1));
  const [targetSeason, setTargetSeason] = useState<(typeof seasons)[number]>(item?.targetSeason ?? "spring");
  const [source, setSource] = useState<CareSource>(item?.source ?? "personal_decision");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(undefined);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const fields: RouterInputs["planning"]["createItem"] = {
      planId,
      personId,
      title: String(form.get("title") ?? ""),
      category,
      status,
      cadence,
      intervalCount: cadence === "recurring_interval" ? Number(form.get("intervalCount")) : null,
      intervalUnit: cadence === "recurring_interval" ? intervalUnit : null,
      timingKind,
      targetDate: timingKind === "date" ? String(form.get("targetDate") ?? "") : null,
      dateMeaning: timingKind === "date" ? dateMeaning : null,
      targetMonth: timingKind === "month" ? Number(targetMonth) : null,
      targetSeason: timingKind === "season" ? targetSeason : null,
      source,
      sourceDetail: nullableText(form.get("sourceDetail")),
      notes: nullableText(form.get("notes")),
    };
    try {
      if (item) await updateItem.mutateAsync({ ...fields, id: item.id });
      else await createItem.mutateAsync(fields);
      await utils.planning.overview.invalidate(); setOpen(false);
      if (!item) formElement.reset();
    } catch (caught) { setError(getErrorMessage(caught)); }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); setError(undefined); }}>
      {!hideTrigger && <DialogTrigger asChild><Button size={compact ? "icon-sm" : "default"} variant={compact ? "ghost" : "default"} aria-label={compact ? `Add care for ${people.find((p) => p.id === defaultPersonId)?.displayName}` : undefined}>{compact ? <Plus /> : <><Plus />Add care item</>}</Button></DialogTrigger>}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{item ? "Edit care item" : "Add care item"}</DialogTitle><DialogDescription>Capture what belongs in this healthcare year. Appointment details come later.</DialogDescription></DialogHeader>
        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor={`item-title-${item?.id ?? "new"}`}>What care should be considered?</Label><Input id={`item-title-${item?.id ?? "new"}`} name="title" defaultValue={item?.title} placeholder="e.g. Dental cleaning" maxLength={160} autoFocus required /></div>
            <FormSelect label="Household member" value={personId} onValueChange={setPersonId} options={people.map((person) => ({ value: person.id, label: person.displayName }))} />
            <FormSelect label="Category" value={category} onValueChange={(value) => setCategory(value as CareCategory)} options={careCategories.map((value) => ({ value, label: careCategoryLabels[value] }))} />
            <FormSelect label="State" value={status} onValueChange={(value) => setStatus(value as CareStatus)} options={careStatuses.map((value) => ({ value, label: careStatusLabels[value] }))} />
            <FormSelect label="Cadence" value={cadence} onValueChange={(value) => setCadence(value as CareCadence)} options={careCadences.map((value) => ({ value, label: careCadenceLabels[value] }))} />
            {cadence === "recurring_interval" && <><div className="space-y-2"><Label htmlFor="interval-count">Repeat every</Label><Input id="interval-count" name="intervalCount" type="number" min={1} max={999} defaultValue={item?.intervalCount ?? 3} required /></div><FormSelect label="Interval unit" value={intervalUnit} onValueChange={(value) => setIntervalUnit(value as (typeof intervalUnits)[number])} options={intervalUnits.map((value) => ({ value, label: intervalUnitLabels[value] }))} /></>}
            <FormSelect label="Timing" value={timingKind} onValueChange={(value) => setTimingKind(value as TimingKind)} options={timingKinds.map((value) => ({ value, label: timingKindLabels[value] }))} />
            {timingKind === "date" && <><div className="space-y-2"><Label htmlFor="target-date">Date</Label><Input id="target-date" name="targetDate" type="date" defaultValue={item?.targetDate ?? ""} required /></div><FormSelect label="Date meaning" value={dateMeaning} onValueChange={(value) => setDateMeaning(value as (typeof dateMeanings)[number])} options={dateMeanings.map((value) => ({ value, label: dateMeaningLabels[value] }))} /></>}
            {timingKind === "month" && <FormSelect label="Target month" value={targetMonth} onValueChange={setTargetMonth} options={monthLabels.map((label, index) => ({ value: String(index + 1), label }))} />}
            {timingKind === "season" && <FormSelect label="Target season" value={targetSeason} onValueChange={(value) => setTargetSeason(value as (typeof seasons)[number])} options={seasons.map((value) => ({ value, label: seasonLabels[value] }))} />}
            <FormSelect label="Source or reason" value={source} onValueChange={(value) => setSource(value as CareSource)} options={careSources.map((value) => ({ value, label: careSourceLabels[value] }))} />
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="source-detail">Source detail <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="source-detail" name="sourceDetail" defaultValue={item?.sourceDetail ?? ""} placeholder="e.g. Recommended at a previous visit" maxLength={2000} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="item-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="item-notes" name="notes" defaultValue={item?.notes ?? ""} placeholder="Anything useful to remember" maxLength={2000} rows={3} /></div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="submit" disabled={createItem.isPending || updateItem.isPending}>{createItem.isPending || updateItem.isPending ? "Saving…" : item ? "Save changes" : "Add to plan"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormSelect({ label, value, onValueChange, options }: { label: string; value: string; onValueChange: (value: string) => void; options: { value: string; label: string }[] }) {
  const id = `select-${label.toLowerCase().replaceAll(" ", "-")}`;
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Select value={value} onValueChange={onValueChange}><SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
}

function HouseholdDialog({ people }: { people: Person[] }) {
  const utils = api.useUtils();
  const createPerson = api.planning.createPerson.useMutation();
  const updatePerson = api.planning.updatePerson.useMutation();
  const deletePerson = api.planning.deletePerson.useMutation();
  const [error, setError] = useState<string>();

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(undefined);
    const formElement = event.currentTarget;
    try { const form = new FormData(formElement); await createPerson.mutateAsync({ displayName: String(form.get("displayName") ?? "") }); formElement.reset(); await utils.planning.overview.invalidate(); }
    catch (caught) { setError(getErrorMessage(caught)); }
  }

  return (
    <Dialog onOpenChange={() => setError(undefined)}>
      <DialogTrigger asChild><Button variant="outline"><Users />Household</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Household members</DialogTitle><DialogDescription>Care items in every year are assigned to one of these people.</DialogDescription></DialogHeader>
        <div className="space-y-3">{people.map((person) => <PersonRow key={person.id} person={person} assignmentCount={person.careItemCount} onRename={async (displayName) => { setError(undefined); try { await updatePerson.mutateAsync({ id: person.id, displayName }); await utils.planning.overview.invalidate(); } catch (caught) { setError(getErrorMessage(caught)); } }} onDelete={async () => { setError(undefined); try { await deletePerson.mutateAsync({ id: person.id }); await utils.planning.overview.invalidate(); } catch (caught) { setError(getErrorMessage(caught)); } }} />)}</div>
        <form onSubmit={add} className="flex gap-2"><div className="flex-1"><Label htmlFor="new-person-name" className="sr-only">Display name</Label><Input id="new-person-name" name="displayName" placeholder="Add a household member" maxLength={80} required /></div><Button type="submit" disabled={createPerson.isPending}><Plus />Add</Button></form>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}

function PersonRow({ person, assignmentCount, onRename, onDelete }: { person: Person; assignmentCount: number; onRename: (name: string) => Promise<void>; onDelete: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <form className="flex gap-2" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await onRename(String(form.get("displayName") ?? "")); setEditing(false); }}><Input name="displayName" defaultValue={person.displayName} maxLength={80} autoFocus required /><Button size="sm">Save</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></form>;
  return <div className="flex items-center gap-3 rounded-lg border p-3"><div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{person.displayName.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{person.displayName}</p><p className="text-xs text-muted-foreground">{assignmentCount} {assignmentCount === 1 ? "care item across all years" : "care items across all years"}</p></div><Button variant="ghost" size="icon-sm" aria-label={`Rename ${person.displayName}`} onClick={() => setEditing(true)}><Pencil /></Button><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Delete ${person.displayName}`} disabled={assignmentCount > 0}><Trash2 /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {person.displayName}?</AlertDialogTitle><AlertDialogDescription>This removes the household member. They can only be deleted when they have no care items in any year.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={onDelete}>Delete person</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>;
}
