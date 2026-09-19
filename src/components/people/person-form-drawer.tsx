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
import { api } from "~/trpc/react";

type PersonFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  person?: {
    id: string;
    displayName: string;
  };
  onSuccess?: () => void;
};

export function PersonFormDrawer({
  open,
  onOpenChange,
  mode,
  person,
  onSuccess,
}: PersonFormDrawerProps) {
  const utils = api.useUtils();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (open) {
      setDisplayName(mode === "edit" && person ? person.displayName : "");
    }
  }, [open, mode, person]);

  const createPerson = api.people.create.useMutation({
    onSuccess: async () => {
      await utils.people.list.invalidate();
      toast.success("Person added.");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => toast.error(error.message),
  });

  const updatePerson = api.people.update.useMutation({
    onSuccess: async () => {
      await utils.people.list.invalidate();
      toast.success("Person updated.");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => toast.error(error.message),
  });

  const isPending = createPerson.isPending || updatePerson.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{mode === "create" ? "Add person" : "Edit person"}</SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Add a household member whose employment records you want to keep."
              : "Update this household member's display name."}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col gap-4 px-4"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = displayName.trim();
            if (!trimmed) {
              toast.error("Enter a name.");
              return;
            }
            if (mode === "create") {
              createPerson.mutate({ displayName: trimmed });
              return;
            }
            if (!person) return;
            updatePerson.mutate({ id: person.id, displayName: trimmed });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="person-display-name">Name</Label>
            <Input
              id="person-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Alex"
              required
            />
          </div>

          <SheetFooter className="px-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {mode === "create" ? "Add person" : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
