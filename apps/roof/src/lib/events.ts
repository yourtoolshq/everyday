import { z } from "zod";

import { calendarDateSchema } from "~/lib/dates";

export const eventCategories = [
  "visit",
  "lease",
  "notice",
  "issue",
  "purchase",
  "construction_change",
  "correspondence",
  "other",
] as const;

export type EventCategory = (typeof eventCategories)[number];

export const eventCategoryLabels = {
  visit: "Property visit",
  lease: "Lease",
  notice: "Notice",
  issue: "Issue or repair",
  purchase: "Purchase",
  construction_change: "Construction change",
  correspondence: "Correspondence",
  other: "Other",
} satisfies Record<EventCategory, string>;

export const eventStatusLabels = {
  planned: "Planned",
  completed: "Completed",
  cancelled: "Cancelled",
} as const;

export const eventFieldsSchema = z.object({
  propertyId: z.string().uuid(),
  eventDate: calendarDateSchema,
  eventTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 14:30.")
    .nullable()
    .optional(),
  status: z.enum(["planned", "completed", "cancelled"]),
  category: z.enum(eventCategories),
  title: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(4000).nullable().optional(),
});
