import { z } from "zod";

export const scenarioInput = z.object({
  people: z.array(z.object({
    personId: z.number().int().positive(),
    rrspContributionCents: z.number().int().nonnegative(),
    rrspDeductionCents: z.number().int().nonnegative(),
    fhsaContributionCents: z.number().int().nonnegative(),
    fhsaDeductionCents: z.number().int().nonnegative(),
  })),
});

export type ScenarioInput = z.infer<typeof scenarioInput>;

export type EstimateWarning = {
  code: string;
  message: string;
  itemId?: number;
};

export function projectedManualAmount(item: {
  status: "planned" | "in_progress" | "complete";
  expectedAmountCents: number | null;
  actualAmountCents: number | null;
}) {
  if (item.status === "complete") return item.actualAmountCents ?? 0;
  if (item.actualAmountCents === null) return item.expectedAmountCents ?? 0;
  if (item.expectedAmountCents === null) return item.actualAmountCents;
  return Math.max(item.actualAmountCents, item.expectedAmountCents);
}
