import { z } from "zod";

import { calendarDateSchema } from "~/lib/dates";

export const propertyKinds = [
  "under_construction",
  "owned",
  "current_rental",
  "past_rental",
] as const;

export type PropertyKind = (typeof propertyKinds)[number];

export const propertyKindLabels = {
  under_construction: "Under construction",
  owned: "Owned home",
  current_rental: "Current rental",
  past_rental: "Past rental",
} satisfies Record<PropertyKind, string>;

export const propertyKindDescriptions = {
  under_construction:
    "A home you are purchasing or building before you take possession.",
  owned: "A home you have taken possession of.",
  current_rental: "Where you live now under a lease.",
  past_rental: "A previous rental you may need to reference later.",
} satisfies Record<PropertyKind, string>;

const optionalDate = calendarDateSchema.nullable().optional();

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const propertyFieldsSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    kind: z.enum(propertyKinds),
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
    renterInsuranceProvider: optionalText(120),
    renterInsurancePolicyNumber: optionalText(80),
    renterInsuranceExpiresOn: optionalDate,
    targetPossessionDate: optionalDate,
    notes: optionalText(4000),
  })
  .superRefine((value, ctx) => {
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
