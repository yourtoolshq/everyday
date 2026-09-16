import type { RouterOutputs } from "~/trpc/react";

export type EstimateData = Extract<RouterOutputs["taxEstimate"]["get"], { supported: true }>;
export type PersonResult = EstimateData["projected"]["people"][number];
export type EstimateMode = "actual" | "projected";

const roundedCad = (cents: number) => new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
}).format(cents / 100);

export const resultLabel = (cents: number) => cents >= 0
  ? `${roundedCad(cents)} refund`
  : `${roundedCad(Math.abs(cents))} owing`;
