"use client";

import { ArrowLeft, Check, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { DocumentManager } from "~/components/documents/document-manager";
import { VisitDialog } from "~/components/visits/visit-dialog";
import { VisitFinancials } from "~/components/visits/visit-financials";
import { formatDateTime } from "~/lib/date-time";
import { visitStatusLabels, type VisitStatus } from "~/lib/visits";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

type VisitDetail = NonNullable<RouterOutputs["visits"]["detail"]>;

const statusStyles: Record<VisitStatus, string> = {
  scheduled: "border-violet-200 bg-violet-50 text-violet-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-stone-200 bg-stone-50 text-stone-700",
};

export function VisitDetailWorkspace({ initialDetail }: { initialDetail: VisitDetail }) {
  const router = useRouter();
  const utils = api.useUtils();
  const detail = api.visits.detail.useQuery(
    { id: initialDetail.visit.id },
    { initialData: initialDetail },
  );
  const setStatus = api.visits.setStatus.useMutation();
  const deleteVisit = api.visits.delete.useMutation();
  const [editOpen, setEditOpen] = useState(false);
  const data = detail.data;

  if (!data) return null;
  const visitId = data.visit.id;

  async function changeStatus(status: VisitStatus) {
    await setStatus.mutateAsync({ id: visitId, status });
    await Promise.all([
      utils.visits.detail.invalidate({ id: visitId }),
      utils.visits.overview.invalidate(),
      utils.planning.overview.invalidate(),
      utils.careProviders.overview.invalidate(),
    ]);
  }

  return (
    <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/visits"><ArrowLeft />Back to visits</Link>
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">{data.visit.title}</h1>
              <Badge variant="outline" className={cn(statusStyles[data.visit.status])}>
                {visitStatusLabels[data.visit.status]}
              </Badge>
            </div>
            <p className="mt-2 font-medium">{formatDateTime(data.visit.startsAt)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.person.displayName}
              {data.provider ? ` · ${data.provider.name}` : ""}
              {data.organization ? ` · ${data.organization.name}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.visit.status === "scheduled" ? (
              <>
                <Button size="sm" variant="outline" onClick={() => changeStatus("completed")}>
                  <Check />Complete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => changeStatus("cancelled")}>
                  <X />Cancel
                </Button>
              </>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil />Edit visit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">
                  <Trash2 />Delete visit
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{data.visit.title}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the visit
                    {data.visit.documentCount > 0
                      ? ` and its ${data.visit.documentCount} attached ${data.visit.documentCount === 1 ? "document" : "documents"}`
                      : ""}
                    , and may change care-goal progress.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={async () => {
                      await deleteVisit.mutateAsync({ id: data.visit.id });
                      await Promise.all([
                        utils.visits.overview.invalidate(),
                        utils.documents.overview.invalidate(),
                        utils.planning.overview.invalidate(),
                        utils.careProviders.overview.invalidate(),
                        utils.benefits.overview.invalidate(),
                      ]);
                      router.push("/visits");
                    }}
                  >
                    Delete visit
                    {data.visit.documentCount > 0 ? " and documents" : ""}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Card className="shadow-none">
          <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
            <Detail label="Household member" value={data.person.displayName} />
            <Detail label="Care goal" value={data.careItem?.title ?? "No linked care goal"} />
            <Detail label="Provider" value={data.provider?.name ?? "No named provider"} />
            <Detail label="Care organization" value={data.organization?.name ?? "No organization"} />
            {data.visit.notes ? (
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{data.visit.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <VisitFinancials
          visitId={data.visit.id}
          costCents={data.visit.costCents}
          financials={data.financials}
          claims={data.claims}
          documents={data.documents}
        />

        <DocumentManager
          visitId={data.visit.id}
          documents={data.documents}
          claims={data.claims}
        />
        <VisitDialog visit={data.visit} open={editOpen} onOpenChange={setEditOpen} hideTrigger />
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}
