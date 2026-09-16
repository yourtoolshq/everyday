import { z } from "zod";

export const careCategories = [
  "primary_care",
  "dental",
  "vision",
  "vaccination",
  "lab_testing",
  "therapy_wellness",
  "specialist_care",
  "other",
] as const;

export const careStatuses = [
  "to_consider",
  "planned",
  "scheduled",
  "completed",
  "skipped",
  "not_due",
] as const;

export const careCadences = [
  "one_time",
  "yearly",
  "recurring_interval",
  "seasonal",
  "as_needed",
] as const;

export const careSources = [
  "preventive_care",
  "provider_recommendation",
  "personal_routine",
  "follow_up",
  "insurance_consideration",
  "personal_decision",
] as const;

export const timingKinds = ["none", "date", "month", "season"] as const;
export const dateMeanings = ["target", "not_before"] as const;
export const intervalUnits = ["weeks", "months", "years"] as const;
export const seasons = ["spring", "summer", "fall", "winter"] as const;

export const careCategoryLabels = {
  primary_care: "Primary care",
  dental: "Dental",
  vision: "Vision",
  vaccination: "Vaccination",
  lab_testing: "Lab/testing",
  therapy_wellness: "Therapy and wellness",
  specialist_care: "Specialist care",
  other: "Other",
} satisfies Record<(typeof careCategories)[number], string>;

export const careStatusLabels = {
  to_consider: "To consider",
  planned: "Planned",
  scheduled: "Scheduled",
  completed: "Completed",
  skipped: "Skipped",
  not_due: "Not due",
} satisfies Record<(typeof careStatuses)[number], string>;

export const careCadenceLabels = {
  one_time: "One-time",
  yearly: "Yearly",
  recurring_interval: "Recurring interval",
  seasonal: "Seasonal",
  as_needed: "As needed",
} satisfies Record<(typeof careCadences)[number], string>;

export const careSourceLabels = {
  preventive_care: "Preventive care",
  provider_recommendation: "Provider recommendation",
  personal_routine: "Personal routine",
  follow_up: "Follow-up from prior care",
  insurance_consideration: "Insurance consideration",
  personal_decision: "Personal decision/other",
} satisfies Record<(typeof careSources)[number], string>;

export const timingKindLabels = {
  none: "No target",
  date: "Exact date",
  month: "Month",
  season: "Season",
} satisfies Record<(typeof timingKinds)[number], string>;

export const dateMeaningLabels = {
  target: "Target date",
  not_before: "Not before",
} satisfies Record<(typeof dateMeanings)[number], string>;

export const intervalUnitLabels = {
  weeks: "Weeks",
  months: "Months",
  years: "Years",
} satisfies Record<(typeof intervalUnits)[number], string>;

export const seasonLabels = {
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
} satisfies Record<(typeof seasons)[number], string>;

export const monthLabels = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const personNameSchema = z.string().trim().min(1).max(80);
export const planYearSchema = z.number().int().min(1900).max(9999);

const optionalText = z.string().trim().max(2_000).nullable();

export const careItemFieldsSchema = z
  .object({
    personId: z.string().uuid(),
    title: z.string().trim().min(1).max(160),
    category: z.enum(careCategories),
    status: z.enum(careStatuses),
    cadence: z.enum(careCadences),
    intervalCount: z.number().int().positive().max(999).nullable(),
    intervalUnit: z.enum(intervalUnits).nullable(),
    timingKind: z.enum(timingKinds),
    targetDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    dateMeaning: z.enum(dateMeanings).nullable(),
    targetMonth: z.number().int().min(1).max(12).nullable(),
    targetSeason: z.enum(seasons).nullable(),
    source: z.enum(careSources),
    sourceDetail: optionalText,
    notes: optionalText,
  })
  .superRefine((value, ctx) => {
    const addIssue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    if (value.cadence === "recurring_interval") {
      if (!value.intervalCount) addIssue("intervalCount", "Enter an interval");
      if (!value.intervalUnit) addIssue("intervalUnit", "Choose an interval unit");
    } else if (value.intervalCount !== null || value.intervalUnit !== null) {
      addIssue("cadence", "Interval details only apply to recurring care");
    }

    if (value.timingKind === "date") {
      if (!value.targetDate) addIssue("targetDate", "Choose a date");
      if (!value.dateMeaning) addIssue("dateMeaning", "Choose what the date means");
    } else if (value.targetDate !== null || value.dateMeaning !== null) {
      addIssue("timingKind", "Date details require exact-date timing");
    }

    if (value.timingKind === "month" && value.targetMonth === null) {
      addIssue("targetMonth", "Choose a month");
    } else if (value.timingKind !== "month" && value.targetMonth !== null) {
      addIssue("timingKind", "A month requires month timing");
    }

    if (value.timingKind === "season" && value.targetSeason === null) {
      addIssue("targetSeason", "Choose a season");
    } else if (value.timingKind !== "season" && value.targetSeason !== null) {
      addIssue("timingKind", "A season requires season timing");
    }
  });

export type CareCategory = (typeof careCategories)[number];
export type CareStatus = (typeof careStatuses)[number];
export type CareCadence = (typeof careCadences)[number];
export type CareSource = (typeof careSources)[number];
export type TimingKind = (typeof timingKinds)[number];

export function careItemSortKey(item: {
  timingKind: TimingKind;
  targetDate: string | null;
  targetMonth: number | null;
  targetSeason: (typeof seasons)[number] | null;
}) {
  if (item.timingKind === "date" && item.targetDate) {
    return Number(item.targetDate.slice(5).replace("-", ""));
  }
  if (item.timingKind === "month" && item.targetMonth) {
    return item.targetMonth * 100;
  }
  if (item.timingKind === "season" && item.targetSeason) {
    const seasonOrder = { spring: 3, summer: 6, fall: 9, winter: 12 };
    return seasonOrder[item.targetSeason] * 100;
  }
  return Number.POSITIVE_INFINITY;
}
