"use client";

import { CalendarPlus, Plus } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";

import { Button } from "~/components/ui/button";
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
import { toDateTimeLocalValue } from "~/lib/date-time";
import { formatCents, parseDollarsToCents } from "~/lib/money";
import { visitStatusLabels, visitStatuses, type VisitStatus } from "~/lib/visits";
import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";

type VisitsOverview = RouterOutputs["visits"]["overview"];
type Visit = VisitsOverview["visits"][number];

function nullableId(value: string) {
  return value === "none" ? null : value;
}

function nullableText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function defaultAppointmentTime() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return toDateTimeLocalValue(date);
}

export function VisitDialog({
  visit,
  defaultPersonId,
  defaultCareItemId,
  defaultTitle,
  defaultStatus = "scheduled",
  trigger,
  triggerLabel = "Add visit",
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger,
}: {
  visit?: Visit;
  defaultPersonId?: string;
  defaultCareItemId?: string;
  defaultTitle?: string;
  defaultStatus?: VisitStatus;
  trigger?: ReactNode;
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const utils = api.useUtils();
  const createVisit = api.visits.create.useMutation();
  const updateVisit = api.visits.update.useMutation();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const overview = api.visits.overview.useQuery(undefined, { enabled: open });
  const data = overview.data;
  const initialPersonId = visit?.personId ?? defaultPersonId ?? data?.people[0]?.id ?? "";
  const [personId, setPersonId] = useState(initialPersonId);
  const [careItemId, setCareItemId] = useState(visit?.careItemId ?? defaultCareItemId ?? "none");
  const [providerId, setProviderId] = useState(visit?.providerId ?? "none");
  const [organizationId, setOrganizationId] = useState(
    visit?.careOrganizationId ?? "none",
  );
  const [status, setStatus] = useState<VisitStatus>(visit?.status ?? defaultStatus);
  const [error, setError] = useState<string>();

  const effectivePersonId = personId || data?.people[0]?.id || "";
  const availableItems =
    data?.careItems.filter((item) => item.personId === effectivePersonId) ?? [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const costInput = String(form.get("cost") ?? "").trim();
    let costCents: number | null = null;
    if (costInput) {
      const parsed = parseDollarsToCents(costInput);
      if (parsed === null) {
        setError("Enter a valid cost amount, such as 110 or 110.50.");
        return;
      }
      costCents = parsed;
    }

    const fields: RouterInputs["visits"]["create"] = {
      personId: effectivePersonId,
      careItemId: nullableId(careItemId),
      providerId: nullableId(providerId),
      careOrganizationId: nullableId(organizationId),
      title: String(form.get("title") ?? ""),
      startsAt: new Date(String(form.get("startsAt") ?? "")).toISOString(),
      status,
      costCents,
      notes: nullableText(form.get("notes")),
    };

    try {
      if (visit) await updateVisit.mutateAsync({ id: visit.id, ...fields });
      else await createVisit.mutateAsync(fields);
      await Promise.all([
        utils.visits.overview.invalidate(),
        utils.planning.overview.invalidate(),
        utils.careProviders.overview.invalidate(),
      ]);
      setOpen(false);
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  function selectProvider(value: string) {
    setProviderId(value);
    const provider = data?.providers.find((candidate) => candidate.id === value);
    if (provider?.careOrganizationId) setOrganizationId(provider.careOrganizationId);
  }

  function selectPerson(value: string) {
    setPersonId(value);
    if (data?.careItems.find((item) => item.id === careItemId)?.personId !== value) {
      setCareItemId("none");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setError(undefined);
      }}
    >
      {!hideTrigger && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button>
              <Plus />
              {triggerLabel}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{visit ? "Edit visit" : defaultStatus === "completed" ? "Record visit" : "Schedule visit"}</DialogTitle>
          <DialogDescription>
            Record the actual healthcare interaction. Link it to a care goal when it contributes to one.
          </DialogDescription>
        </DialogHeader>
        {!data ? (
          <p className="py-6 text-sm text-muted-foreground">Loading visit details…</p>
        ) : data.people.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">Add a household member before recording visits.</p>
        ) : data.providers.length === 0 && data.organizations.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <CalendarPlus className="mx-auto mb-3 size-6 text-muted-foreground" />
            <p className="font-medium">Add a care provider first</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A visit needs a provider or care organization for its history.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/care-providers">Open Care Providers</Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`visit-title-${visit?.id ?? "new"}`}>Visit title or purpose</Label>
                <Input
                  id={`visit-title-${visit?.id ?? "new"}`}
                  name="title"
                  defaultValue={visit?.title ?? defaultTitle ?? ""}
                  placeholder="e.g. Dental cleaning"
                  maxLength={160}
                  autoFocus
                  required
                />
              </div>
              <VisitSelect
                label="Household member"
                value={effectivePersonId}
                onValueChange={selectPerson}
                options={data.people.map((person) => ({ value: person.id, label: person.displayName }))}
              />
              <VisitSelect
                label="Status"
                value={status}
                onValueChange={(value) => setStatus(value as VisitStatus)}
                options={visitStatuses.map((value) => ({ value, label: visitStatusLabels[value] }))}
              />
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`visit-start-${visit?.id ?? "new"}`}>Appointment date and time</Label>
                <Input
                  id={`visit-start-${visit?.id ?? "new"}`}
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={visit ? toDateTimeLocalValue(visit.startsAt) : defaultAppointmentTime()}
                  required
                />
              </div>
              <VisitSelect
                label="Care organization"
                value={organizationId}
                onValueChange={setOrganizationId}
                options={[
                  { value: "none", label: "No organization" },
                  ...data.organizations.map((organization) => ({
                    value: organization.id,
                    label: organization.name,
                  })),
                ]}
              />
              <VisitSelect
                label="Provider"
                value={providerId}
                onValueChange={selectProvider}
                options={[
                  { value: "none", label: "No named provider" },
                  ...data.providers.map((provider) => ({ value: provider.id, label: provider.name })),
                ]}
              />
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`visit-care-item-${visit?.id ?? "new"}`}>Care goal</Label>
                <Select value={careItemId} onValueChange={setCareItemId}>
                  <SelectTrigger id={`visit-care-item-${visit?.id ?? "new"}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked care goal</SelectItem>
                    {availableItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`visit-cost-${visit?.id ?? "new"}`}>
                  Total cost <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id={`visit-cost-${visit?.id ?? "new"}`}
                  name="cost"
                  inputMode="decimal"
                  placeholder="e.g. 110.00"
                  defaultValue={
                    visit?.costCents != null ? formatCents(visit.costCents).replace("$", "") : ""
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`visit-notes-${visit?.id ?? "new"}`}>Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Textarea
                  id={`visit-notes-${visit?.id ?? "new"}`}
                  name="notes"
                  defaultValue={visit?.notes ?? ""}
                  placeholder="Recommendations, context, or anything useful to remember"
                  maxLength={2000}
                  rows={4}
                />
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={createVisit.isPending || updateVisit.isPending}>
                {createVisit.isPending || updateVisit.isPending
                  ? "Saving…"
                  : visit
                    ? "Save changes"
                    : defaultStatus === "completed"
                      ? "Record visit"
                      : "Schedule visit"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VisitSelect({
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
  const id = `visit-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
