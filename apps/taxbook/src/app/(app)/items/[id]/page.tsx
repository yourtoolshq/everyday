import { notFound } from "next/navigation";

import { TaxItemDetail } from "~/components/tax-items/tax-item-detail";

export default async function TaxItemPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  return <TaxItemDetail id={id} />;
}
