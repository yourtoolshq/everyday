import { Badge } from "~/components/ui/badge";
import { itemStatusLabels, type ItemStatus } from "~/domain/tax-item";
import { cn } from "~/lib/utils";

const styles: Record<ItemStatus, string> = {
  planned: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200",
  in_progress: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  complete: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
};

export function ItemStatusBadge({
  status,
  className,
}: {
  status: ItemStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(styles[status], className)}>
      {itemStatusLabels[status]}
    </Badge>
  );
}
