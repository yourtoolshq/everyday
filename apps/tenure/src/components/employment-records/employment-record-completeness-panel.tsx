"use client";

import { useState } from "react";
import { toast } from "sonner";

import { RequiredDocumentUploadSheet } from "~/components/employment-records/required-document-upload-sheet";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  employmentRecordCompletenessLabels,
  type EmploymentRecordRequirement,
} from "~/lib/employment-record-completeness";
import type { RequiredDocumentKind } from "~/lib/employment-document-suggestions";
import { api, type RouterOutputs } from "~/trpc/react";

type Requirement = RouterOutputs["employmentRecords"]["completenessByEmployment"]["requirements"][number];

type EmploymentRecordCompletenessPanelProps = {
  employmentId: string;
  employerName: string;
  personName: string;
};

function formatSummary(
  summary: RouterOutputs["employmentRecords"]["completenessByEmployment"]["summary"],
) {
  const satisfiedCount = summary.completeCount + summary.notApplicableCount;
  const parts = [`${satisfiedCount}/${summary.expectedCount} satisfied`];
  if (summary.missingCount > 0) {
    parts.push(`${summary.missingCount} missing`);
  }
  return parts.join(" · ");
}

function statusVariant(status: Requirement["status"]) {
  if (status === "complete") return "secondary" as const;
  if (status === "not_applicable") return "outline" as const;
  return "destructive" as const;
}

function requirementUploadKind(
  requirement: EmploymentRecordRequirement,
): RequiredDocumentKind | null {
  if (requirement.kind === "offer_letter") return "offer_letter";
  if (requirement.kind === "compensation_change") return "compensation_change";
  return null;
}

export function EmploymentRecordCompletenessPanel({
  employmentId,
  employerName,
  personName,
}: EmploymentRecordCompletenessPanelProps) {
  const utils = api.useUtils();
  const completeness = api.employmentRecords.completenessByEmployment.useQuery({ employmentId });
  const compensationChanges = api.compensationChanges.listByEmployment.useQuery({ employmentId });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadRequirement, setUploadRequirement] = useState<Requirement | null>(null);

  const markNotApplicable = api.employmentRecords.markNotApplicable.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.employmentRecords.completenessByEmployment.invalidate({ employmentId }),
        utils.employmentRecords.listForReview.invalidate(),
      ]);
      toast.success("Marked as not applicable.");
    },
    onError: (error) => toast.error(error.message),
  });

  const undoNotApplicable = api.employmentRecords.undoNotApplicable.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.employmentRecords.completenessByEmployment.invalidate({ employmentId }),
        utils.employmentRecords.listForReview.invalidate(),
      ]);
      toast.success("Requirement restored.");
    },
    onError: (error) => toast.error(error.message),
  });

  function openUpload(requirement: Requirement) {
    setUploadRequirement(requirement);
    setUploadOpen(true);
  }

  const uploadKind = uploadRequirement ? requirementUploadKind(uploadRequirement) : null;
  const uploadCompensationChange = uploadRequirement?.compensationChangeId
    ? compensationChanges.data?.find((item) => item.id === uploadRequirement.compensationChangeId)
    : null;

  const requirements = completeness.data?.requirements ?? [];
  const summary = completeness.data?.summary;

  return (
    <>
      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base">Employment records</CardTitle>
            {summary ? (
              <p className="text-xs text-muted-foreground">{formatSummary(summary)}</p>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {completeness.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading record checklist…</p>
          ) : requirements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No record requirements yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {requirements.map((requirement) => (
                <li
                  key={requirement.key}
                  className="flex items-start justify-between gap-3 px-3 py-3 first:pt-3 last:pb-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{requirement.label}</p>
                      <Badge variant={statusVariant(requirement.status)}>
                        {employmentRecordCompletenessLabels[requirement.status]}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {requirement.status === "missing" && requirementUploadKind(requirement) ? (
                      <Button size="sm" variant="outline" onClick={() => openUpload(requirement)}>
                        Upload
                      </Button>
                    ) : null}
                    {requirement.status === "missing" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          markNotApplicable.mutate({
                            employmentId,
                            requirementKey: requirement.key,
                          })
                        }
                      >
                        Mark N/A
                      </Button>
                    ) : null}
                    {requirement.status === "not_applicable" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          undoNotApplicable.mutate({
                            employmentId,
                            requirementKey: requirement.key,
                          })
                        }
                      >
                        Undo N/A
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <RequiredDocumentUploadSheet
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) setUploadRequirement(null);
        }}
        employmentId={employmentId}
        employerName={employerName}
        personName={personName}
        kind={uploadKind}
        compensationChange={uploadCompensationChange ?? null}
      />
    </>
  );
}
