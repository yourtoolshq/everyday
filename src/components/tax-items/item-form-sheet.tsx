"use client";

import { useState, type FormEvent } from "react";
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
import { centsToDollars, dollarsToCents } from "~/domain/money";
import {
  itemStatuses,
  itemStatusLabels,
  itemTypes,
  itemTypeLabels,
  taxTreatments,
  taxTreatmentDescriptions,
  taxTreatmentLabels,
  taxTreatmentLineSuggestions,
  taxTreatmentRules,
  type ItemStatus,
  type ItemType,
  type TaxTreatment,
} from "~/domain/tax-item";
import { api, type RouterOutputs } from "~/trpc/react";

type TaxItem = RouterOutputs["taxItem"]["list"]["items"][number];
type Person = RouterOutputs["settings"]["get"]["people"][number];

export function ItemFormSheet({
  item,
  people,
  open,
  onOpenChange,
}: {
  item: TaxItem | null;
  people: Person[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const [name, setName] = useState(item?.name ?? "");
  const [taxLineReference, setTaxLineReference] = useState(
    item?.taxLineReference ?? "",
  );
  const [type, setType] = useState<ItemType>(item?.type ?? "income");
  const [owner, setOwner] = useState(
    item?.ownerKind === "person" && item.personId
      ? `person:${item.personId}`
      : "household",
  );
  const [expected, setExpected] = useState(
    centsToDollars(item?.expectedAmountCents ?? null),
  );
  const [actual, setActual] = useState(
    centsToDollars(item?.actualAmountCents ?? null),
  );
  const [status, setStatus] = useState<ItemStatus>(item?.status ?? "planned");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [taxTreatment, setTaxTreatment] = useState<TaxTreatment | null>(item?.taxTreatment ?? null);

  const finish = async (message: string) => {
    await Promise.all([
      utils.taxItem.list.invalidate(),
      utils.taxItem.get.invalidate(),
      utils.taxItem.overview.invalidate(),
      utils.taxEstimate.get.invalidate(),
    ]);
    toast.success(message);
    onOpenChange(false);
  };
  const create = api.taxItem.create.useMutation({
    onSuccess: () => finish("Tax item created."),
    onError: (error) => toast.error(error.message),
  });
  const update = api.taxItem.update.useMutation({
    onSuccess: () => finish("Tax item updated."),
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const expectedAmountCents = dollarsToCents(expected);
    const actualAmountCents = dollarsToCents(actual);
    if ((expected.trim() && expectedAmountCents === null) || (actual.trim() && actualAmountCents === null)) {
      toast.error("Amounts must be zero or a positive dollar value.");
      return;
    }
    const personId = owner.startsWith("person:")
      ? Number(owner.replace("person:", ""))
      : null;
    const values = {
      name,
      taxLineReference: taxLineReference.trim() || null,
      type,
      ownerKind: personId === null ? ("household" as const) : ("person" as const),
      personId,
      expectedAmountCents,
      actualAmountCents,
      status,
      notes: notes.trim() || null,
      taxTreatment,
    };
    if (item) update.mutate({ id: item.id, ...values });
    else create.mutate(values);
  }

  const pending = create.isPending || update.isPending;
  const ownerKind = owner.startsWith("person:") ? "person" : "household";
  const availableTreatments = taxTreatments.filter((value) => value !== "employment_income" && value !== "self_employment_income" && taxTreatmentRules[value].type === type && taxTreatmentRules[value].ownerKind === ownerKind);

  function changeTreatment(value: string) {
    const treatment = value === "none" ? null : value as TaxTreatment;
    setTaxTreatment(treatment);
    if (treatment && taxLineReference.trim() === "") setTaxLineReference(taxTreatmentLineSuggestions[treatment] ?? "");
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>{item ? "Edit tax item" : "Add tax item"}</SheetTitle>
            <SheetDescription>
              Track the current value and progress without estimating its tax effect.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="item-name">Name</Label>
              <Input id="item-name" placeholder="e.g. Employment income" value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-line-reference">Tax line/reference</Label>
              <Input
                id="tax-line-reference"
                placeholder="e.g. 20800 or Schedule 7"
                value={taxLineReference}
                onChange={(event) => setTaxLineReference(event.target.value)}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Optional filing reference; it does not affect calculations.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(value) => setType(value as ItemType)}>
                  <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {itemTypes.map((value) => <SelectItem key={value} value={value}>{itemTypeLabels[value]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select value={owner} onValueChange={setOwner}>
                  <SelectTrigger aria-label="Owner"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="household">Household</SelectItem>
                    {people.map((person) => <SelectItem key={person.id} value={`person:${person.id}`}>{person.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tax treatment</Label>
              <Select value={taxTreatment ?? "none"} onValueChange={changeTreatment}>
                <SelectTrigger aria-label="Tax treatment"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tracking only — not used in estimate</SelectItem>
                  {availableTreatments.map((value) => <SelectItem key={value} value={value}>{taxTreatmentLabels[value]}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{taxTreatment ? taxTreatmentDescriptions[taxTreatment] : "This item remains visible in Tax Book but is excluded from the tax estimate."}</p>
              {taxTreatment && !availableTreatments.includes(taxTreatment) ? <p className="text-xs text-destructive">The current Type or Owner is incompatible. Choose a new treatment or Tracking only.</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expected-amount">Expected amount</Label>
                <div className="relative"><span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span><Input id="expected-amount" className="pl-7 tabular-nums" inputMode="decimal" placeholder="Optional" value={expected} onChange={(event) => setExpected(event.target.value)} /></div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="actual-amount">Actual amount</Label>
                <div className="relative"><span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span><Input id="actual-amount" className="pl-7 tabular-nums" inputMode="decimal" placeholder="Optional" value={actual} onChange={(event) => setActual(event.target.value)} disabled={item?.valueSource === "records"} /></div>
                {item?.valueSource === "records" ? <p className="text-xs text-muted-foreground">Calculated from supporting Records. Edit the Records to change this amount.</p> : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as ItemStatus)}>
                <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {itemStatuses.map((value) => <SelectItem key={value} value={value}>{itemStatusLabels[value]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-notes">Notes</Label>
              <Textarea id="item-notes" rows={6} placeholder="Optional context, reminders, or assumptions" value={notes} onChange={(event) => setNotes(event.target.value)} />
              <p className="text-xs text-muted-foreground">{notes.length.toLocaleString()} / 4,000</p>
            </div>
          </div>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={pending}>{pending ? "Saving…" : item ? "Save changes" : "Add tax item"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
