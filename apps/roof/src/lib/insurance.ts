import { z } from "zod";

import { calendarDateSchema } from "~/lib/dates";

export const insuranceFieldsSchema = z
  .object({
    propertyId: z.string().uuid(),
    type: z.enum(["tenant", "home"]),
    provider: z.string().trim().max(120).nullable().optional(),
    policyNumber: z.string().trim().max(80).nullable().optional(),
    startsOn: calendarDateSchema.nullable().optional(),
    endsOn: calendarDateSchema.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.provider && !value.policyNumber)
      ctx.addIssue({
        code: "custom",
        path: ["provider"],
        message: "Enter a provider or policy number.",
      });
    if (value.startsOn && value.endsOn && value.startsOn > value.endsOn)
      ctx.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "Coverage end must be on or after its start.",
      });
  });
export function insuranceStatus(
  record: { startsOn: string | null; endsOn: string | null },
  today: string,
) {
  if (record.endsOn && record.endsOn < today) return "Ended";
  if (record.startsOn && record.startsOn > today) return "Upcoming";
  if (!record.startsOn || !record.endsOn) return "Dates incomplete";
  return "In effect";
}
