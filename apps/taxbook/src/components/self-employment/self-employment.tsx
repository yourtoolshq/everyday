"use client";

import { useState } from "react";
import Link from "next/link";
import { IconArrowRight, IconPlus } from "@tabler/icons-react";
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
import { Skeleton } from "~/components/ui/skeleton";
import { formatCad } from "~/domain/money";
import { api } from "~/trpc/react";
import { ActivityFormSheet } from "./activity-form-sheet";

type Activity = RouterOutputs["business"]["list"]["items"][number];
export function SelfEmployment() {
  const utils = api.useUtils();
  const activities = api.business.list.useQuery();
  const settings = api.settings.get.useQuery();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const remove = api.business.delete.useMutation({
    onSuccess: async () => {
      setDeleting(null);
      await Promise.all([
        utils.business.list.invalidate(),
        utils.taxItem.list.invalidate(),
        utils.taxItem.overview.invalidate(),
        utils.taxEstimate.get.invalidate(),
      ]);
      toast.success("Self-employment business deleted.");
    },
    onError: (error) => toast.error(error.message),
  });
  if (activities.isLoading || settings.isLoading)
    return (
      <div className="space-y-5 p-6">
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
      </div>
    );
  if (!activities.data || !settings.data || activities.error || settings.error)
    return (
      <div className="text-destructive p-6 text-sm">
        Unable to load self-employment businesses.
      </div>
    );
  const add = () => {
    setEditing(null);
    setFormOpen(true);
  };
  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-primary text-sm font-medium">
            {activities.data.year.year} tax year
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Self-employment</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Track each sole-proprietor business separately for its T2125.
          </p>
        </div>
        <Button onClick={add}>
          <IconPlus /> Add business
        </Button>
      </div>
      {activities.data.items.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {activities.data.items.map((activity) => (
            <Card key={activity.id}>
              <CardHeader>
                <CardDescription>{activity.personName} · T2125</CardDescription>
                <CardTitle>{activity.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Revenue</p>
                    <p className="font-medium tabular-nums">
                      {formatCad(activity.totals.revenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expenses</p>
                    <p className="font-medium tabular-nums">
                      {formatCad(activity.totals.expenses)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Net income (loss)</p>
                    <p
                      className={`font-semibold tabular-nums ${activity.totals.net < 0 ? "text-amber-700" : ""}`}
                    >
                      {formatCad(activity.totals.net)}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex gap-2">
                  <Button asChild>
                    <Link href={`/self-employment/${activity.id}`}>
                      Manage Records <IconArrowRight />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(activity);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setDeleting(activity)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex min-h-56 flex-col items-center justify-center text-center">
            <p className="font-medium">No self-employment businesses yet</p>
            <p className="text-muted-foreground mt-1 max-w-md text-sm">
              Add a side hustle to track its revenue, eligible expenses, and net
              result.
            </p>
            <Button className="mt-4" variant="outline" onClick={add}>
              <IconPlus /> Add business
            </Button>
          </CardContent>
        </Card>
      )}
      {formOpen ? (
        <ActivityFormSheet
          key={editing?.id ?? "new"}
          activity={editing}
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
            <AlertDialogTitle>Delete this business?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.name}”, all its Records and attachments, and its
              managed Tax Item will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              disabled={remove.isPending}
              onClick={() => deleting && remove.mutate({ id: deleting.id })}
            >
              {remove.isPending ? "Deleting…" : "Delete business"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
