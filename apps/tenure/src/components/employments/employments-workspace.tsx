"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmploymentFormDrawer } from "~/components/employments/employment-form-drawer";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { formatCompensationRate } from "~/lib/compensation";
import { employmentStatusLabels } from "~/lib/employment-status";
import { api } from "~/trpc/react";

function employmentHeading(jobTitle: string | null, employerName: string) {
  if (jobTitle) return `${jobTitle} at ${employerName}`;
  return employerName;
}

export function EmploymentsWorkspace() {
  const utils = api.useUtils();
  const employments = api.employments.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [editEmployment, setEditEmployment] = useState<
    | (typeof employments.data extends (infer Item)[] | undefined
        ? Item
        : never)
    | null
  >(null);

  const deleteEmployment = api.employments.delete.useMutation({
    onSuccess: async () => {
      await utils.employments.list.invalidate();
      toast.success("Employment removed.");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Add employment
        </Button>
      </div>

      <div className="space-y-3">
        {employments.data?.map((employment) => (
          <Card key={employment.id} className="shadow-none">
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <Link
                href={`/employments/${employment.id}`}
                className="min-w-0 flex-1 space-y-1"
              >
                <p className="font-medium">
                  {employment.jobTitle ? (
                    <>
                      {employment.jobTitle}
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        at {employment.employerName}
                      </span>
                    </>
                  ) : (
                    employment.employerName
                  )}
                </p>
                <p className="text-muted-foreground text-sm">
                  {employment.personName}
                </p>
                <p className="text-muted-foreground text-sm">
                  {employmentStatusLabels[employment.status]}
                  {employment.startDate
                    ? ` · from ${employment.startDate}`
                    : ""}
                  {employment.endDate ? ` to ${employment.endDate}` : ""}
                </p>
                {employment.currentCompensation ? (
                  <p className="text-muted-foreground text-sm">
                    {formatCompensationRate(employment.currentCompensation)}
                  </p>
                ) : null}
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${employmentHeading(employment.jobTitle, employment.employerName)}`}
                  onClick={() => setEditEmployment(employment)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${employmentHeading(employment.jobTitle, employment.employerName)}`}
                  onClick={() => deleteEmployment.mutate({ id: employment.id })}
                >
                  <Trash2 />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {employments.data?.length === 0 ? (
          <p className="text-muted-foreground text-sm">No employments yet.</p>
        ) : null}
      </div>

      <EmploymentFormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />

      <EmploymentFormDrawer
        open={Boolean(editEmployment)}
        onOpenChange={(open) => {
          if (!open) setEditEmployment(null);
        }}
        mode="edit"
        employment={editEmployment ?? undefined}
        onSuccess={() => setEditEmployment(null)}
      />
    </>
  );
}
