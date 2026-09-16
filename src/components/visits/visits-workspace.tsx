"use client";

import { CalendarCheck2, Check, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { VisitDialog } from "~/components/visits/visit-dialog";
import { formatDateTime } from "~/lib/date-time";
import { visitStatusLabels, type VisitStatus } from "~/lib/visits";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

type Overview = RouterOutputs["visits"]["overview"];
type Visit = Overview["visits"][number];

const statusStyles: Record<VisitStatus, string> = {
  scheduled: "border-violet-200 bg-violet-50 text-violet-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-stone-200 bg-stone-50 text-stone-700",
};

export function VisitsWorkspace({ initialOverview }: { initialOverview: Overview }) {
  const overview = api.visits.overview.useQuery(undefined, { initialData: initialOverview });
  const data = overview.data;
  const [personFilter, setPersonFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");

  const filtered = data.visits.filter((visit) => {
    if (personFilter !== "all" && visit.personId !== personFilter) return false;
    if (providerFilter.startsWith("provider:") && visit.providerId !== providerFilter.slice(9)) {
      return false;
    }
    if (
      providerFilter.startsWith("organization:") &&
      visit.careOrganizationId !== providerFilter.slice(13)
    ) {
      return false;
    }
    return true;
  });
  const upcoming = [...filtered]
    .filter((visit) => visit.status === "scheduled")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const history = [...filtered]
    .filter((visit) => visit.status !== "scheduled")
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  return (
    <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Household care</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">Visits</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Keep upcoming appointments and a lightweight history of the care that happened.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <VisitDialog
              defaultStatus="completed"
              trigger={<Button variant="outline"><Check />Record past visit</Button>}
            />
            <VisitDialog trigger={<Button><Plus />Schedule visit</Button>} />
          </div>
        </div>

        <Card className="shadow-none">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            <FilterSelect
              label="Household member"
              value={personFilter}
              onValueChange={setPersonFilter}
              options={[
                { value: "all", label: "Everyone" },
                ...data.people.map((person) => ({ value: person.id, label: person.displayName })),
              ]}
            />
            <FilterSelect
              label="Provider or organization"
              value={providerFilter}
              onValueChange={setProviderFilter}
              options={[
                { value: "all", label: "All providers and organizations" },
                ...data.providers.map((provider) => ({
                  value: `provider:${provider.id}`,
                  label: provider.name,
                })),
                ...data.organizations.map((organization) => ({
                  value: `organization:${organization.id}`,
                  label: organization.name,
                })),
              ]}
            />
          </CardContent>
        </Card>

        <VisitSection
          title="Upcoming"
          description="Scheduled healthcare interactions"
          visits={upcoming}
          overview={data}
          empty="No scheduled visits match these filters."
        />
        <VisitSection
          title="History"
          description="Completed and cancelled visits"
          visits={history}
          overview={data}
          empty="No visit history matches these filters."
        />
      </div>
    </main>
  );
}

function VisitSection({
  title,
  description,
  visits,
  overview,
  empty,
}: {
  title: string;
  description: string;
  visits: Visit[];
  overview: Overview;
  empty: string;
}) {
  return (
    <section aria-labelledby={`visits-${title.toLowerCase()}`}>
      <div className="mb-3">
        <h3 id={`visits-${title.toLowerCase()}`} className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {visits.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex items-center justify-center gap-3 py-8 text-sm text-muted-foreground">
            <CalendarCheck2 className="size-5" />{empty}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {visits.map((visit) => <VisitCard key={visit.id} visit={visit} overview={overview} />)}
        </div>
      )}
    </section>
  );
}

function VisitCard({ visit, overview }: { visit: Visit; overview: Overview }) {
  const utils = api.useUtils();
  const setStatus = api.visits.setStatus.useMutation();
  const deleteVisit = api.visits.delete.useMutation();
  const [editOpen, setEditOpen] = useState(false);
  const person = overview.people.find((candidate) => candidate.id === visit.personId);
  const provider = overview.providers.find((candidate) => candidate.id === visit.providerId);
  const organization = overview.organizations.find(
    (candidate) => candidate.id === visit.careOrganizationId,
  );
  const careItem = overview.careItems.find((candidate) => candidate.id === visit.careItemId);

  async function changeStatus(status: VisitStatus) {
    await setStatus.mutateAsync({ id: visit.id, status });
    await Promise.all([
      utils.visits.overview.invalidate(),
      utils.planning.overview.invalidate(),
      utils.careProviders.overview.invalidate(),
    ]);
  }

  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">
              <Link href={`/visits/${visit.id}`} className="hover:underline">{visit.title}</Link>
            </h4>
            <Badge variant="outline" className={cn(statusStyles[visit.status])}>
              {visitStatusLabels[visit.status]}
            </Badge>
          </div>
          <p className="mt-2 text-sm font-medium">{formatDateTime(visit.startsAt)}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{person?.displayName ?? "Unknown household member"}</span>
            {provider ? <span>{provider.name}</span> : null}
            {organization ? <span>{organization.name}</span> : null}
            {careItem ? <span>Goal: {careItem.title}</span> : null}
          </div>
          {visit.notes ? <p className="mt-3 whitespace-pre-wrap text-sm">{visit.notes}</p> : null}
          {visit.documentCount > 0 ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              <FileText className="size-4" />
              {visit.documentCount} {visit.documentCount === 1 ? "document" : "documents"}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/visits/${visit.id}`}>View details</Link>
          </Button>
          {visit.status === "scheduled" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => changeStatus("completed")}>
                <Check />Complete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => changeStatus("cancelled")}>
                <X />Cancel
              </Button>
            </>
          ) : null}
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${visit.title}`} onClick={() => setEditOpen(true)}>
            <Pencil />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={`Delete ${visit.title}`} className="text-muted-foreground hover:text-destructive">
                <Trash2 />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{visit.title}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the visit
                  {visit.documentCount > 0
                    ? ` and its ${visit.documentCount} attached ${visit.documentCount === 1 ? "document" : "documents"}`
                    : ""}
                  , and may change care-goal progress.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={async () => {
                    await deleteVisit.mutateAsync({ id: visit.id });
                    await Promise.all([
                      utils.visits.overview.invalidate(),
                      utils.planning.overview.invalidate(),
                      utils.careProviders.overview.invalidate(),
                    ]);
                  }}
                >
                  Delete visit{visit.documentCount > 0 ? " and documents" : ""}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
      <VisitDialog visit={visit} open={editOpen} onOpenChange={setEditOpen} hideTrigger />
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const id = `filter-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
