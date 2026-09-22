"use client";

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
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { ItemFormSheet } from "./item-form-sheet";
import { TaxItemsTable } from "./tax-items-table";

type TaxItem = RouterOutputs["taxItem"]["list"]["items"][number];

export function TaxItems() {
  const utils = api.useUtils();
  const items = api.taxItem.list.useQuery();
  const settings = api.settings.get.useQuery();
  const [editing, setEditing] = useState<TaxItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<TaxItem | null>(null);
  const deleteItem = api.taxItem.delete.useMutation({
    onSuccess: async () => {
      setDeleting(null);
      await Promise.all([
        utils.taxItem.list.invalidate(),
        utils.taxItem.overview.invalidate(),
        utils.taxDocument.list.invalidate(),
        utils.taxDocument.overview.invalidate(),
        utils.taxEstimate.get.invalidate(),
      ]);
      toast.success("Tax item deleted.");
    },
    onError: (error) => toast.error(error.message),
  });

  function addItem() {
    setEditing(null);
    setFormOpen(true);
  }

  function editItem(item: TaxItem) {
    setEditing(item);
    setFormOpen(true);
  }

  if (items.isLoading || settings.isLoading) {
    return (
      <div className="space-y-5 p-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (items.error || settings.error || !items.data || !settings.data) {
    return (
      <div className="text-destructive p-6 text-sm">
        Unable to load tax items.{" "}
        {items.error?.message ?? settings.error?.message}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-primary text-sm font-medium">
            {items.data.year.year} tax year
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Tax items
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Track expected and actual amounts as the year develops.
          </p>
        </div>
        <Button onClick={addItem}>
          <IconPlus /> Add tax item
        </Button>
      </div>
      <TaxItemsTable
        items={items.data.items}
        people={settings.data.people}
        onAdd={addItem}
        onEdit={editItem}
        onDelete={setDeleting}
      />
      {formOpen ? (
        <ItemFormSheet
          key={editing?.id ?? "new"}
          item={editing}
          people={settings.data.people}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      ) : null}
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this tax item?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.name}”, all of its supporting Records, Tax Documents,
              and attachments will be permanently removed from this tax year.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={deleteItem.isPending}
              onClick={() => deleting && deleteItem.mutate({ id: deleting.id })}
            >
              {deleteItem.isPending ? "Deleting…" : "Delete item"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
