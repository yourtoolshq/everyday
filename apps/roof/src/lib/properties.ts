import { z } from "zod";

import { calendarDateSchema } from "~/lib/dates";

export const propertyRelationships = ["rental", "purchase"] as const;
export type PropertyRelationship = (typeof propertyRelationships)[number];
export const relationshipLabels = {
  rental: "Rental",
  purchase: "Purchased home",
};
export const propertyStages = [
  "current",
  "past",
  "purchase_in_progress",
  "under_construction",
  "awaiting_possession",
  "owned",
] as const;
export type PropertyStage = (typeof propertyStages)[number];
export const stageLabels = {
  current: "Current rental",
  past: "Past rental",
  purchase_in_progress: "Purchase in progress",
  under_construction: "Under construction",
  awaiting_possession: "Awaiting possession",
  owned: "Owned",
} satisfies Record<PropertyStage, string>;
export function stagesFor(relationship: PropertyRelationship) {
  return relationship === "rental"
    ? (["current", "past"] as const)
    : ([
        "purchase_in_progress",
        "under_construction",
        "awaiting_possession",
        "owned",
      ] as const);
}

const optionalDate = calendarDateSchema.nullable().optional();

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const propertyFieldsSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    relationship: z.enum(propertyRelationships),
    stage: z.enum(propertyStages),
    possessionDate: optionalDate,
    addressLine1: optionalText(160),
    addressLine2: optionalText(160),
    city: optionalText(80),
    region: optionalText(80),
    postalCode: optionalText(20),
    moveInDate: optionalDate,
    moveOutDate: optionalDate,
    leaseStartDate: optionalDate,
    leaseEndDate: optionalDate,
    leaseNotes: optionalText(4000),
    landlordName: optionalText(120),
    landlordEmail: z.string().trim().email().max(160).nullable().optional(),
    landlordPhone: optionalText(40),
    targetPossessionDate: optionalDate,
    notes: optionalText(4000),
  })
  .superRefine((value, ctx) => {
    if (!stagesFor(value.relationship).some((stage) => stage === value.stage))
      ctx.addIssue({
        code: "custom",
        path: ["stage"],
        message: "Choose a stage for this relationship.",
      });
    if (
      value.relationship === "rental" &&
      (value.targetPossessionDate || value.possessionDate)
    )
      ctx.addIssue({
        code: "custom",
        path: ["targetPossessionDate"],
        message: "Possession dates belong to purchased homes.",
      });
    if (
      value.relationship === "purchase" &&
      [
        value.leaseStartDate,
        value.leaseEndDate,
        value.leaseNotes,
        value.landlordName,
        value.landlordEmail,
        value.landlordPhone,
      ].some(Boolean)
    )
      ctx.addIssue({
        code: "custom",
        path: ["leaseStartDate"],
        message: "Lease and landlord details belong to rentals.",
      });
    for (const [start, end] of [
      ["moveInDate", "moveOutDate"],
      ["leaseStartDate", "leaseEndDate"],
    ] as const) {
      if (value[start] && value[end] && value[start]! > value[end]!)
        ctx.addIssue({
          code: "custom",
          path: [end],
          message: "End date must be on or after the start date.",
        });
    }
  });

export function formatPropertyAddress(property: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
}) {
  const lines = [
    property.addressLine1?.trim(),
    property.addressLine2?.trim(),
  ].filter(Boolean);
  const locality = [property.city?.trim(), property.region?.trim()]
    .filter(Boolean)
    .join(", ");
  const postal = property.postalCode?.trim();
  const cityLine = [locality, postal].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);
  return lines.length > 0 ? lines.join("\n") : null;
}

export function formatDateLabel(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const date = new Date(`${value.trim()}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
