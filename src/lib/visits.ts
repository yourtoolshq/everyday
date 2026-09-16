import { z } from "zod";

export const visitStatuses = ["scheduled", "completed", "cancelled"] as const;
export const careProgressStates = [
  "planned",
  "in_progress",
  "completed",
  "not_pursuing",
] as const;

export const visitStatusLabels = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
} satisfies Record<(typeof visitStatuses)[number], string>;

export const careProgressLabels = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  not_pursuing: "Not pursuing",
} satisfies Record<(typeof careProgressStates)[number], string>;

const optionalId = z.string().uuid().nullable();
const optionalText = z.string().trim().max(2_000).nullable();

export const visitFieldsSchema = z
  .object({
    personId: z.string().uuid(),
    careItemId: optionalId,
    providerId: optionalId,
    careOrganizationId: optionalId,
    title: z.string().trim().min(1).max(160),
    startsAt: z.string().datetime({ offset: true }),
    status: z.enum(visitStatuses),
    notes: optionalText,
  })
  .superRefine((value, ctx) => {
    if (!value.providerId && !value.careOrganizationId) {
      ctx.addIssue({
        code: "custom",
        path: ["providerId"],
        message: "Choose a provider or care organization",
      });
    }
  });

export const careOrganizationFieldsSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phoneNumbers: z.array(z.string().trim().min(1).max(40)).max(10),
  websiteUrl: z.string().url().max(500).nullable(),
  bookingUrl: z.string().url().max(500).nullable(),
});

export const providerFieldsSchema = z.object({
  name: z.string().trim().min(1).max(160),
  careOrganizationId: optionalId,
});

export type VisitStatus = (typeof visitStatuses)[number];
export type CareProgressState = (typeof careProgressStates)[number];

export function deriveCareProgress(input: {
  targetVisitCount: number;
  notPursuingAt: string | null;
  visits: Array<{ status: VisitStatus }>;
}) {
  let completedVisitCount = 0;
  let scheduledVisitCount = 0;

  for (const visit of input.visits) {
    if (visit.status === "completed") completedVisitCount += 1;
    if (visit.status === "scheduled") scheduledVisitCount += 1;
  }

  let progress: CareProgressState = "planned";
  if (input.notPursuingAt) progress = "not_pursuing";
  else if (completedVisitCount >= input.targetVisitCount) progress = "completed";
  else if (completedVisitCount > 0 || scheduledVisitCount > 0) progress = "in_progress";

  return { progress, completedVisitCount, scheduledVisitCount };
}
