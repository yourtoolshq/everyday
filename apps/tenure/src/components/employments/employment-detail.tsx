"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import type { RouterOutputs } from "~/trpc/react";
import { EmploymentCompensationPanel } from "~/components/compensation/employment-compensation-panel";
import { EmploymentDiscussionsPanel } from "~/components/discussions/employment-discussions-panel";
import { EmploymentPaySummaryCard } from "~/components/employment-records/employment-pay-summary-card";
import { EmploymentRecordCompletenessPanel } from "~/components/employment-records/employment-record-completeness-panel";
import { EmploymentDocumentsPanel } from "~/components/employments/employment-documents-panel";
import { EmploymentFormDrawer } from "~/components/employments/employment-form-drawer";
import { EmploymentPaychecksPanel } from "~/components/paychecks/employment-paychecks-panel";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatCompensationRate } from "~/lib/compensation";
import { employmentStatusLabels } from "~/lib/employment-status";
import { api } from "~/trpc/react";

type EmploymentDetailProps = {
  employment: RouterOutputs["employments"]["getById"];
};

function formatDate(value: string | null) {
  return value ?? "Not set";
}

export function EmploymentDetail({ employment }: EmploymentDetailProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const currentCompensation =
    api.compensationChanges.getCurrentByEmployment.useQuery({
      employmentId: employment.id,
    });

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  employment.status === "current" ? "default" : "secondary"
                }
              >
                {employmentStatusLabels[employment.status]}
              </Badge>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight">
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
            </h2>
            <p className="text-muted-foreground">{employment.personName}</p>
          </div>
          <Button onClick={() => setEditOpen(true)}>
            <Pencil />
            Edit employment
          </Button>
        </div>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Employment details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Employer
              </p>
              <Link
                href={`/employers/${employment.employerId}`}
                className="text-primary text-sm font-medium hover:underline"
              >
                {employment.employerName}
              </Link>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Person
              </p>
              <p className="text-sm">{employment.personName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Job title
              </p>
              <p className="text-sm">{employment.jobTitle ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Status
              </p>
              <p className="text-sm">
                {employmentStatusLabels[employment.status]}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Current compensation
              </p>
              <p className="text-sm">
                {currentCompensation.data
                  ? formatCompensationRate(currentCompensation.data)
                  : "Not recorded"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Start date
              </p>
              <p className="text-sm">{formatDate(employment.startDate)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                End date
              </p>
              <p className="text-sm">{formatDate(employment.endDate)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-muted-foreground text-sm font-medium">Notes</p>
              <p className="text-sm whitespace-pre-wrap">
                {employment.notes ?? "No notes yet."}
              </p>
            </div>
          </CardContent>
        </Card>

        <EmploymentPaySummaryCard employmentId={employment.id} />

        <div className="grid gap-4">
          <EmploymentRecordCompletenessPanel
            employmentId={employment.id}
            employerName={employment.employerName}
            personName={employment.personName}
          />
          <EmploymentPaychecksPanel
            employmentId={employment.id}
            employerName={employment.employerName}
            personName={employment.personName}
            payFrequency={employment.payFrequency}
            biweeklyAnchorDate={employment.biweeklyAnchorDate}
            deductionSettings={employment.deductionSettings}
            startDate={employment.startDate}
            endDate={employment.endDate}
            status={employment.status}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <EmploymentCompensationPanel
              employmentId={employment.id}
              startDate={employment.startDate}
            />
            <EmploymentDocumentsPanel employmentId={employment.id} />
          </div>
          <EmploymentDiscussionsPanel employmentId={employment.id} />
        </div>
      </div>

      <EmploymentFormDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        employment={employment}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
