import { z } from "zod";

import { accountTermsSchema } from "~/lib/account-terms";

export const accountEventTypes = [
  "account_change",
  "correspondence",
  "phone_call",
  "other",
] as const;

export type AccountEventType = (typeof accountEventTypes)[number];

export const accountEventTypeLabels = {
  account_change: "Account change",
  correspondence: "Correspondence",
  phone_call: "Phone call",
  other: "Other",
} satisfies Record<AccountEventType, string>;

export const accountEventMetadataSchema = z.object({
  type: z.enum(accountEventTypes),
  title: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(5000).nullable().optional(),
  startDate: z.string().trim().min(1).max(10),
  resolvedDate: z.string().trim().max(10).nullable().optional(),
});

export const accountEventTermsSchema = z.object({
  recordTermsChange: z.boolean(),
  effectiveDate: z.string().trim().max(10).nullable().optional(),
  snapshotNotes: z.string().trim().max(2000).nullable().optional(),
  terms: accountTermsSchema.optional(),
});

export const createAccountEventInputSchema = accountEventMetadataSchema.extend({
  accountId: z.string().uuid(),
  termsChange: accountEventTermsSchema.optional(),
});

export const updateAccountEventInputSchema = accountEventMetadataSchema.extend({
  id: z.string().uuid(),
});

export const maxEventAttachmentBytes = 25 * 1024 * 1024;
