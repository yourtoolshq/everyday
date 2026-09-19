import { z } from "zod";

import { formatMoney } from "~/lib/money";

export const compensationTypes = ["annual_salary", "hourly_rate", "commission"] as const;
export type CompensationType = (typeof compensationTypes)[number];

export const compensationCurrencies = ["CAD", "INR"] as const;
export type CompensationCurrency = (typeof compensationCurrencies)[number];

export const compensationTypeLabels = {
  annual_salary: "Annual salary",
  hourly_rate: "Hourly rate",
  commission: "Commission",
} satisfies Record<CompensationType, string>;

export const compensationCurrencyLabels = {
  CAD: "Canadian dollar (CAD)",
  INR: "Indian rupee (INR)",
} satisfies Record<CompensationCurrency, string>;

export type CompensationChangeRecord = {
  id: string;
  employmentId: string;
  type: CompensationType;
  currency: CompensationCurrency;
  effectiveDate: string;
  amountCents: number | null;
  commissionBasisPoints: number | null;
  notes: string | null;
  documentId: string | null;
  discussionId: string | null;
};

export type CompensationDelta = {
  previousAmountCents: number | null;
  previousCommissionBasisPoints: number | null;
  amountChangeCents: number | null;
  percentChange: number | null;
  commissionChangeBasisPoints: number | null;
};

export type CompensationChangeWithDelta = CompensationChangeRecord & {
  delta: CompensationDelta | null;
  documentTitle: string | null;
  discussionTitle: string | null;
};

export const compensationInputSchema = z
  .object({
    type: z.enum(compensationTypes),
    currency: z.enum(compensationCurrencies).default("CAD"),
    effectiveDate: z.string().trim().min(1).max(10),
    amountCents: z.number().int().nonnegative().nullable().optional(),
    commissionBasisPoints: z.number().int().min(0).max(100_00).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    documentId: z.string().uuid().nullable().optional(),
    discussionId: z.string().uuid().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "commission") {
      if (value.commissionBasisPoints === null || value.commissionBasisPoints === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a commission percentage.",
          path: ["commissionBasisPoints"],
        });
      }
      return;
    }

    if (value.amountCents === null || value.amountCents === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter an amount.",
        path: ["amountCents"],
      });
    }
  });

export function commissionPercentToBasisPoints(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim().replaceAll(",", "");
  if (normalized === "") return null;

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100) return null;
  return Math.round(amount * 100);
}

export function basisPointsToCommissionPercent(basisPoints: number): string {
  const percent = basisPoints / 100;
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(2).replace(/\.?0+$/, "");
}

export function sortCompensationChanges<T extends { effectiveDate: string; createdAt?: string }>(
  changes: T[],
) {
  return [...changes].sort((left, right) => {
    const byDate = right.effectiveDate.localeCompare(left.effectiveDate);
    if (byDate !== 0) return byDate;
    if (left.createdAt && right.createdAt) {
      return right.createdAt.localeCompare(left.createdAt);
    }
    return 0;
  });
}

export function getCurrentCompensationChange<T extends CompensationChangeRecord>(
  changes: T[],
  asOfDate = new Date().toISOString().slice(0, 10),
) {
  const eligible = changes
    .filter((change) => change.effectiveDate <= asOfDate)
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate));

  return eligible[0] ?? null;
}

export function enrichCompensationChanges(
  changes: CompensationChangeRecord[],
  links: {
    documentTitleById: Map<string, string>;
    discussionTitleById: Map<string, string>;
  },
): CompensationChangeWithDelta[] {
  const sortedAsc = [...changes].sort((left, right) =>
    left.effectiveDate.localeCompare(right.effectiveDate),
  );

  const previousByType = new Map<CompensationType, CompensationChangeRecord>();

  const deltas = new Map<string, CompensationDelta | null>();
  for (const change of sortedAsc) {
    const previous = previousByType.get(change.type) ?? null;
    deltas.set(change.id, buildDelta(change, previous));
    previousByType.set(change.type, change);
  }

  return sortCompensationChanges(changes).map((change) => ({
    ...change,
    delta: deltas.get(change.id) ?? null,
    documentTitle: change.documentId
      ? links.documentTitleById.get(change.documentId) ?? null
      : null,
    discussionTitle: change.discussionId
      ? links.discussionTitleById.get(change.discussionId) ?? null
      : null,
  }));
}

function buildDelta(
  change: CompensationChangeRecord,
  previous: CompensationChangeRecord | null,
): CompensationDelta | null {
  if (!previous) return null;

  if (change.type === "commission") {
    if (
      change.commissionBasisPoints === null ||
      previous.commissionBasisPoints === null
    ) {
      return null;
    }

    return {
      previousAmountCents: null,
      previousCommissionBasisPoints: previous.commissionBasisPoints,
      amountChangeCents: null,
      percentChange: null,
      commissionChangeBasisPoints:
        change.commissionBasisPoints - previous.commissionBasisPoints,
    };
  }

  if (change.amountCents === null || previous.amountCents === null) return null;
  if (change.currency !== previous.currency) return null;

  const amountChangeCents = change.amountCents - previous.amountCents;
  const percentChange =
    previous.amountCents === 0
      ? null
      : (amountChangeCents / previous.amountCents) * 100;

  return {
    previousAmountCents: previous.amountCents,
    previousCommissionBasisPoints: null,
    amountChangeCents,
    percentChange,
    commissionChangeBasisPoints: null,
  };
}

export function formatCompensationRate(change: CompensationChangeRecord): string {
  if (change.type === "commission") {
    if (change.commissionBasisPoints === null) return "Commission not set";
    return `${basisPointsToCommissionPercent(change.commissionBasisPoints)}% commission`;
  }

  if (change.amountCents === null) return "Amount not set";

  if (change.type === "annual_salary") {
    return `${formatMoney(change.amountCents, change.currency)}/year`;
  }

  return `${formatMoney(change.amountCents, change.currency)}/hour`;
}

export type CompensationDeltaDisplay = {
  label: string;
  direction: "increase" | "decrease";
};

export function getCompensationDeltaDisplay(
  change: CompensationChangeWithDelta,
): CompensationDeltaDisplay | null {
  const delta = change.delta;
  if (!delta) return null;

  if (change.type === "commission") {
    if (delta.commissionChangeBasisPoints === null || delta.commissionChangeBasisPoints === 0) {
      return null;
    }

    const points = delta.commissionChangeBasisPoints / 100;
    const sign = points > 0 ? "+" : "−";
    return {
      label: `${sign}${basisPointsToCommissionPercent(Math.abs(delta.commissionChangeBasisPoints))} pts`,
      direction: points > 0 ? "increase" : "decrease",
    };
  }

  if (delta.amountChangeCents === null || delta.amountChangeCents === 0) return null;

  const sign = delta.amountChangeCents > 0 ? "+" : "−";
  const amount = formatMoney(Math.abs(delta.amountChangeCents), change.currency);
  const percent =
    delta.percentChange === null
      ? null
      : ` (${sign}${Math.abs(delta.percentChange).toFixed(1)}%)`;

  return {
    label: `${sign}${amount}${percent ?? ""}`,
    direction: delta.amountChangeCents > 0 ? "increase" : "decrease",
  };
}

export function formatCompensationDelta(change: CompensationChangeWithDelta): string | null {
  return getCompensationDeltaDisplay(change)?.label ?? null;
}
