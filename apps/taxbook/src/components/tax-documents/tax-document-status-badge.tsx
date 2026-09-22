import type { TaxDocumentStatus } from "~/domain/tax-document";
import { Badge } from "~/components/ui/badge";
import { taxDocumentStatusLabels } from "~/domain/tax-document";

const styles: Record<TaxDocumentStatus, string> = {
  expected:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200",
  received:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  ready:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  used: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200",
};

export function TaxDocumentStatusBadge({
  status,
}: {
  status: TaxDocumentStatus;
}) {
  return (
    <Badge variant="outline" className={styles[status]}>
      {taxDocumentStatusLabels[status]}
    </Badge>
  );
}
