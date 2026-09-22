import { PayReviewWorkspace } from "~/components/paychecks/pay-review-workspace";

export const dynamic = "force-dynamic";

export default function PayStubReviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Pay review</p>
        <h2 className="text-3xl font-semibold tracking-tight">Pay stub completeness</h2>
        <p className="max-w-2xl text-muted-foreground">
          Review missing paychecks and pay stubs across all employments. Useful for monthly
          check-ins.
        </p>
      </div>
      <PayReviewWorkspace />
    </main>
  );
}
