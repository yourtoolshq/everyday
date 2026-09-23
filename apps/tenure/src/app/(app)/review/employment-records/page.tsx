import { EmploymentRecordsReviewWorkspace } from "~/components/employment-records/employment-records-review-workspace";

export const dynamic = "force-dynamic";

export default function EmploymentRecordsReviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6">
      <div className="space-y-2">
        <p className="text-primary text-sm font-medium">Record review</p>
        <h2 className="text-3xl font-semibold tracking-tight">
          Employment record completeness
        </h2>
        <p className="text-muted-foreground max-w-2xl">
          Review missing offer letters and compensation supporting documents
          across all employments.
        </p>
      </div>
      <EmploymentRecordsReviewWorkspace />
    </main>
  );
}
