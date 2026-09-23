"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import type { RouterOutputs } from "~/trpc/react";
import { EmployerFormDrawer } from "~/components/employers/employer-form-drawer";
import { EmploymentFormDrawer } from "~/components/employments/employment-form-drawer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { employmentStatusLabels } from "~/lib/employment-status";

type EmployerDetailProps = {
  employer: RouterOutputs["employers"]["getById"];
};

function formatPeriod(startDate: string | null, endDate: string | null) {
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (startDate) return `from ${startDate}`;
  if (endDate) return `until ${endDate}`;
  return "Dates not set";
}

export function EmployerDetail({ employer }: EmployerDetailProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [createEmploymentOpen, setCreateEmploymentOpen] = useState(false);

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight">
              {employer.name}
            </h2>
            {employer.website ? (
              <p className="text-muted-foreground text-sm">
                {employer.website}
              </p>
            ) : null}
            {employer.notes ? (
              <p className="text-muted-foreground max-w-2xl text-sm whitespace-pre-wrap">
                {employer.notes}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil />
              Edit employer
            </Button>
            <Button onClick={() => setCreateEmploymentOpen(true)}>
              <Plus />
              Add employment
            </Button>
          </div>
        </div>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Employment periods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {employer.employments.map((employment) => (
              <Link
                key={employment.id}
                href={`/employments/${employment.id}`}
                className="hover:bg-muted/40 block rounded-lg border p-4 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{employment.personName}</p>
                  <Badge
                    variant={
                      employment.status === "current" ? "default" : "secondary"
                    }
                  >
                    {employmentStatusLabels[employment.status]}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {employment.jobTitle ? `${employment.jobTitle} · ` : ""}
                  {formatPeriod(employment.startDate, employment.endDate)}
                </p>
              </Link>
            ))}
            {employer.employments.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No employment periods yet. Add one to start keeping records for
                this employer.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <EmployerFormDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        employer={employer}
        onSuccess={() => router.refresh()}
      />

      <EmploymentFormDrawer
        open={createEmploymentOpen}
        onOpenChange={setCreateEmploymentOpen}
        mode="create"
        defaultEmployerId={employer.id}
        onSuccess={(employmentId) => {
          router.push(`/employments/${employmentId}`);
          router.refresh();
        }}
      />
    </>
  );
}
