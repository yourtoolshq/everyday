"use client";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button"; import { Input } from "~/components/ui/input"; import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { api, type RouterOutputs } from "~/trpc/react";
type Activity = RouterOutputs["business"]["list"]["items"][number]; type Person = RouterOutputs["settings"]["get"]["people"][number];
export function ActivityFormSheet({ activity, people, open, onOpenChange }: { activity: Activity | null; people: Person[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const utils = api.useUtils(); const [name, setName] = useState(activity?.name ?? ""); const [personId, setPersonId] = useState(String(activity?.personId ?? people[0]?.id ?? ""));
  const finish = async (message: string) => { await Promise.all([utils.business.list.invalidate(), utils.taxItem.list.invalidate(), utils.taxItem.overview.invalidate(), utils.taxEstimate.get.invalidate()]); toast.success(message); onOpenChange(false); };
  const create = api.business.create.useMutation({ onSuccess: () => finish("Self-employment business created."), onError: (error) => toast.error(error.message) });
  const update = api.business.update.useMutation({ onSuccess: () => finish("Self-employment business updated."), onError: (error) => toast.error(error.message) });
  function submit(event: FormEvent) { event.preventDefault(); const values = { name, personId: Number(personId) }; if (activity) update.mutate({ id: activity.id, ...values }); else create.mutate(values); }
  const pending = create.isPending || update.isPending;
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="w-full sm:max-w-lg"><form className="flex min-h-full flex-col" onSubmit={submit}><SheetHeader><SheetTitle>{activity ? "Edit business" : "Add self-employment business"}</SheetTitle><SheetDescription>Create one business for each distinct line of work reported on its own T2125.</SheetDescription></SheetHeader><div className="flex-1 space-y-5 px-4 py-6"><div className="space-y-2"><Label htmlFor="activity-name">Business name</Label><Input id="activity-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Web services" required autoFocus /></div><div className="space-y-2"><Label>Owner</Label><Select value={personId} onValueChange={setPersonId}><SelectTrigger aria-label="Business owner"><SelectValue /></SelectTrigger><SelectContent>{people.map((person) => <SelectItem key={person.id} value={String(person.id)}>{person.name}</SelectItem>)}</SelectContent></Select></div></div><SheetFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={pending}>{pending ? "Saving…" : "Save business"}</Button></SheetFooter></form></SheetContent></Sheet>;
}
