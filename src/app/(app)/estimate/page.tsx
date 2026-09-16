import { TaxEstimate } from "~/components/tax-estimate/tax-estimate";
import { db } from "~/server/db";

export default async function TaxEstimatePage() {
  const activeYear = await db.query.taxYears.findFirst({
    where: (table, operators) => operators.eq(table.isActive, true),
  });
  return <TaxEstimate taxYearId={activeYear?.id} />;
}
