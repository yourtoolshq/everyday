import {
  itemStatuses,
  itemTypes,
  type ItemStatus,
  type ItemType,
} from "./tax-item";

export type OverviewItem = {
  id: number;
  name: string;
  type: ItemType;
  status: ItemStatus;
  expectedAmountCents: number | null;
  actualAmountCents: number | null;
  updatedAt: Date;
};

export function buildOverview(items: OverviewItem[]) {
  const amounts = Object.fromEntries(
    itemTypes.map((type) => [
      type,
      { expectedAmountCents: 0, actualAmountCents: 0, itemCount: 0 },
    ]),
  ) as Record<
    ItemType,
    {
      expectedAmountCents: number;
      actualAmountCents: number;
      itemCount: number;
    }
  >;
  const statuses = Object.fromEntries(
    itemStatuses.map((status) => [status, 0]),
  ) as Record<ItemStatus, number>;

  for (const item of items) {
    amounts[item.type].itemCount += 1;
    amounts[item.type].expectedAmountCents += item.expectedAmountCents ?? 0;
    amounts[item.type].actualAmountCents += item.actualAmountCents ?? 0;
    statuses[item.status] += 1;
  }

  const attention = [...items]
    .filter(
      (item) =>
        item.status !== "complete" ||
        (item.expectedAmountCents !== null && item.actualAmountCents === null),
    )
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 8);

  return { amounts, statuses, attention, totalItems: items.length };
}
