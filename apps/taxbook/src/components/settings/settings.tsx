"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { toast } from "sonner";

import type { RouterOutputs } from "~/trpc/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
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
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { PersonRow } from "./person-row";
import { TenureIntegrationSetting } from "./tenure-integration-setting";
import { ThemeSetting } from "./theme-setting";

type Person = RouterOutputs["settings"]["get"]["people"][number];

export function Settings() {
  const utils = api.useUtils();
  const settings = api.settings.get.useQuery();
  const [householdName, setHouseholdName] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [deleting, setDeleting] = useState<Person | null>(null);
  const refresh = () => settings.refetch();
  const renameHousehold = api.settings.renameHousehold.useMutation({
    onSuccess: async () => {
      setHouseholdName(null);
      await refresh();
      toast.success("Household updated.");
    },
    onError: (error) => toast.error(error.message),
  });
  const renamePerson = api.settings.renamePerson.useMutation({
    onSuccess: async () => {
      await Promise.all([refresh(), utils.taxItem.list.invalidate()]);
      toast.success("Person updated.");
    },
    onError: (error) => toast.error(error.message),
  });
  const addPerson = api.settings.addPerson.useMutation({
    onSuccess: async () => {
      setAddOpen(false);
      setNewPersonName("");
      await refresh();
      toast.success("Person added.");
    },
    onError: (error) => toast.error(error.message),
  });
  const deletePerson = api.settings.deletePerson.useMutation({
    onSuccess: async () => {
      setDeleting(null);
      await refresh();
      toast.success("Person removed.");
    },
    onError: (error) => toast.error(error.message),
  });

  if (settings.isLoading)
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-16 w-80" />
        <Skeleton className="h-52 w-full max-w-3xl" />
        <Skeleton className="h-72 w-full max-w-3xl" />
      </div>
    );
  if (!settings.data)
    return (
      <div className="text-destructive p-6 text-sm">
        Settings could not be loaded.
      </div>
    );
  const data = settings.data;
  const displayedHouseholdName = householdName ?? data.household.name;

  function saveHousehold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    renameHousehold.mutate({ name: displayedHouseholdName });
  }

  function submitPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addPerson.mutate({ name: newPersonName });
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage the household details used to organize tax items.
        </p>
      </div>
      <ThemeSetting />
      <TenureIntegrationSetting />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Household</CardTitle>
          <CardDescription>
            This label appears throughout your Tax Book.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex max-w-xl items-end gap-2"
            onSubmit={saveHousehold}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="settings-household">Household label</Label>
              <Input
                id="settings-household"
                value={displayedHouseholdName}
                onChange={(event) => setHouseholdName(event.target.value)}
                required
              />
            </div>
            <Button
              disabled={
                householdName === null ||
                displayedHouseholdName.trim() === data.household.name ||
                renameHousehold.isPending
              }
            >
              Save
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle className="text-base">People</CardTitle>
            <CardDescription className="mt-1.5">
              Items can belong to a person or the household as a whole.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <IconPlus /> Add person
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.people.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              canDelete={data.people.length > 1}
              pending={renamePerson.isPending || deletePerson.isPending}
              onRename={(id, name) => renamePerson.mutate({ id, name })}
              onDelete={setDeleting}
            />
          ))}
          <p className="text-muted-foreground pt-2 text-xs">
            A person who owns tax items cannot be removed. Rename them instead.
          </p>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <form onSubmit={submitPerson}>
            <DialogHeader>
              <DialogTitle>Add a person</DialogTitle>
              <DialogDescription>
                Add another household member who can own tax items.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-6">
              <Label htmlFor="new-person-name">Name</Label>
              <Input
                id="new-person-name"
                value={newPersonName}
                onChange={(event) => setNewPersonName(event.target.value)}
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
              <Button disabled={addPerson.isPending}>
                {addPerson.isPending ? "Adding…" : "Add person"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This is only allowed when the person does not own any tax items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() =>
                deleting && deletePerson.mutate({ id: deleting.id })
              }
            >
              Remove person
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
