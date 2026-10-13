import { z } from "zod";

import { calendarDateSchema } from "~/lib/dates";

export const leaseFieldsSchema = z
  .object({
    propertyId: z.string().uuid(),
    title: z.string().trim().min(1).max(160),
    termType: z.enum(["fixed_term", "month_to_month"]),
    startsOn: calendarDateSchema.nullable().optional(),
    endsOn: calendarDateSchema.nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.startsOn && value.endsOn && value.startsOn > value.endsOn)
      ctx.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "Lease end must be on or after its start.",
      });
  });
export type LeaseTerm = "fixed_term" | "month_to_month";
type LeaseDates = {
  startsOn: string | null;
  endsOn: string | null;
  termType: LeaseTerm;
};
export function leaseStatus(record: LeaseDates, today: string) {
  if (record.endsOn && record.endsOn < today) return "Ended";
  if (record.startsOn && record.startsOn > today) return "Upcoming";
  if (!record.startsOn || (record.termType === "fixed_term" && !record.endsOn))
    return "Dates incomplete";
  return "Active";
}
export function leaseSummary(records: LeaseDates[], today: string) {
  const count = records.filter(
    (record) => leaseStatus(record, today) === "Active",
  ).length;
  return count > 1
    ? "Overlapping active leases — check the recorded dates."
    : count === 1
      ? "One active lease recorded"
      : "No active lease recorded";
}
