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
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";

type EmployerFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  employer?: {
    id: string;
    name: string;
    website: string | null;
    notes: string | null;
  };
  onSuccess?: () => void;
};

export function EmployerFormDrawer({
  open,
  onOpenChange,
  mode,
  employer,
  onSuccess,
}: EmployerFormDrawerProps) {
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      if (mode === "edit" && employer) {
        setName(employer.name);
        setWebsite(employer.website ?? "");
        setNotes(employer.notes ?? "");
      } else {
        setName("");
        setWebsite("");
        setNotes("");
      }
    }
  }, [open, mode, employer]);

  const createEmployer = api.employers.create.useMutation({
    onSuccess: async () => {
      await utils.employers.list.invalidate();
      toast.success("Employer added.");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateEmployer = api.employers.update.useMutation({
    onSuccess: async (updated) => {
      await Promise.all([
        utils.employers.list.invalidate(),
        utils.employers.getById.invalidate({ id: updated.id }),
      ]);
      toast.success("Employer updated.");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => toast.error(error.message),
  });

  const isPending = createEmployer.isPending || updateEmployer.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{mode === "create" ? "Add employer" : "Edit employer"}</SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Add an organization where someone in your household works or worked."
              : "Update this employer's details."}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col gap-4 px-4"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmedName = name.trim();
            if (!trimmedName) {
              toast.error("Enter an employer name.");
              return;
            }
            const payload = {
              name: trimmedName,
              website: website.trim() || null,
              notes: notes.trim() || null,
            };
            if (mode === "create") {
              createEmployer.mutate(payload);
              return;
            }
            if (!employer) return;
            updateEmployer.mutate({ id: employer.id, ...payload });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="employer-name">Employer name</Label>
            <Input
              id="employer-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employer-website">Website</Label>
            <Input
              id="employer-website"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employer-notes">Notes</Label>
            <Textarea
              id="employer-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
            />
          </div>

          <SheetFooter className="px-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {mode === "create" ? "Add employer" : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
