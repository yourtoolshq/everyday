"use client";

import { type FormEvent, useState } from "react";
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
import { Textarea } from "~/components/ui/textarea";
import { api, type RouterOutputs } from "~/trpc/react";

type Institution = RouterOutputs["institutions"]["list"][number];

type InstitutionFormState = {
  name: string;
  website: string;
  notes: string;
};

function emptyFormState(): InstitutionFormState {
  return { name: "", website: "", notes: "" };
}

function institutionToFormState(institution: Institution): InstitutionFormState {
  return {
    name: institution.name,
    website: institution.website ?? "",
    notes: institution.notes ?? "",
  };
}

function toInstitutionPayload(form: InstitutionFormState) {
  return {
    name: form.name.trim(),
    website: form.website.trim() || null,
    notes: form.notes.trim() || null,
  };
}

export function InstitutionFormSheet({
  institution,
  open,
  onOpenChange,
}: {
  institution: Institution | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const [form, setForm] = useState<InstitutionFormState>(
    institution ? institutionToFormState(institution) : emptyFormState(),
  );

  const finish = async (message: string) => {
    await utils.institutions.list.invalidate();
    toast.success(message);
    onOpenChange(false);
  };

  const createInstitution = api.institutions.create.useMutation({
    onSuccess: () => finish("Institution added."),
    onError: (error) => toast.error(error.message),
  });
  const updateInstitution = api.institutions.update.useMutation({
    onSuccess: () => finish("Institution updated."),
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) return;
    const payload = toInstitutionPayload(form);
    if (institution) {
      updateInstitution.mutate({ id: institution.id, ...payload });
    } else {
      createInstitution.mutate(payload);
    }
  }

  const pending = createInstitution.isPending || updateInstitution.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>{institution ? "Edit institution" : "Add institution"}</SheetTitle>
            <SheetDescription>
              Banks, lenders, and investment providers that hold household accounts.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="institution-name">Institution name</Label>
              <Input
                id="institution-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="institution-website">Website</Label>
              <Input
                id="institution-website"
                value={form.website}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
                placeholder="https://"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="institution-notes">Notes</Label>
              <Textarea
                id="institution-notes"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                rows={4}
              />
            </div>
          </div>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : institution ? "Save changes" : "Add institution"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
