import { z } from "zod";
import type { Buffer } from "node:buffer";

export const filingKinds = ["original_return", "adjustment"] as const;
export const filingStatuses = ["preparing", "submitted", "assessed"] as const;
export const returnCopyStatuses = [
  "not_added_yet",
  "attached",
  "unavailable",
] as const;
export const assessmentKinds = [
  "notice_of_assessment",
  "notice_of_reassessment",
] as const;
export const taxYearStatuses = [
  "tracking",
  "preparing",
  "filed",
  "assessed",
  "archived",
] as const;

export type FilingKind = (typeof filingKinds)[number];
export type FilingStatus = (typeof filingStatuses)[number];
export type ReturnCopyStatus = (typeof returnCopyStatuses)[number];
export type AssessmentKind = (typeof assessmentKinds)[number];
export type TaxYearStatus = (typeof taxYearStatuses)[number];

export const filingKindLabels: Record<FilingKind, string> = {
  original_return: "Original return",
  adjustment: "Adjustment",
};

export const filingStatusLabels: Record<FilingStatus, string> = {
  preparing: "Preparing",
  submitted: "Submitted",
  assessed: "Assessed",
};

export const returnCopyStatusLabels: Record<ReturnCopyStatus, string> = {
  not_added_yet: "Not added yet",
  attached: "Attached",
  unavailable: "Unavailable",
};

export const assessmentKindLabels: Record<AssessmentKind, string> = {
  notice_of_assessment: "Notice of Assessment",
  notice_of_reassessment: "Notice of Reassessment",
};

export const taxYearStatusLabels: Record<TaxYearStatus, string> = {
  tracking: "Tracking",
  preparing: "Preparing",
  filed: "Filed",
  assessed: "Assessed",
  archived: "Archived",
};

export const allowedFilingAttachmentTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
] as const;

export const MAX_FILING_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format.");

const signedResultCents = z
  .number()
  .int()
  .nullable()
  .superRefine((value, context) => {
    if (value === null) return;
    if (value === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a refund or amount owing, or leave the result blank.",
      });
    }
  });

const originalReturnFields = {
  submissionDate: isoDate.nullable(),
  expectedResultCents: signedResultCents,
  returnCopyStatus: z.enum(returnCopyStatuses, {
    errorMap: () => ({
      message: "Choose whether the submitted T1 is attached or unavailable.",
    }),
  }),
  notes: z.string().trim().max(4000).nullable(),
};

export const originalReturnInput = z.object({
  personId: z
    .number({ invalid_type_error: "Choose a household member." })
    .int()
    .positive({ message: "Choose a household member." }),
  ...originalReturnFields,
});

export const originalReturnUpdateInput = z.object({
  ...originalReturnFields,
  status: z.enum(filingStatuses),
});

const adjustmentFields = {
  reason: z.string().trim().min(1, "Enter a reason for the adjustment.").max(500),
  submissionDate: isoDate.nullable(),
  expectedChangeCents: signedResultCents,
  returnCopyStatus: z.enum(returnCopyStatuses, {
    errorMap: () => ({
      message:
        "Choose whether the submitted adjustment is attached or unavailable.",
    }),
  }),
  notes: z.string().trim().max(4000).nullable(),
  affectedTaxItemIds: z.array(z.number().int().positive()).max(20),
};

export const adjustmentInput = z.object({
  personId: z
    .number({ invalid_type_error: "Choose a household member." })
    .int()
    .positive({ message: "Choose a household member." }),
  ...adjustmentFields,
});

export const adjustmentUpdateInput = z.object({
  ...adjustmentFields,
  status: z.enum(filingStatuses),
});

export const assessmentInput = z.object({
  assessmentDate: isoDate,
  assessedResultCents: signedResultCents,
  refundOrPaymentDate: isoDate.nullable(),
  notes: z.string().trim().max(4000).nullable(),
});

export type OriginalReturnInput = z.infer<typeof originalReturnInput>;
export type OriginalReturnUpdateInput = z.infer<
  typeof originalReturnUpdateInput
>;
export type AdjustmentInput = z.infer<typeof adjustmentInput>;
export type AdjustmentUpdateInput = z.infer<typeof adjustmentUpdateInput>;
export type AssessmentInput = z.infer<typeof assessmentInput>;

export type FilingAttachmentInput = {
  fileName: string;
  mimeType: (typeof allowedFilingAttachmentTypes)[number];
  sizeBytes: number;
  data: Buffer;
};

export type FilingAttachmentAction =
  | { type: "keep" }
  | { type: "remove" }
  | { type: "replace"; attachment: FilingAttachmentInput }
  | { type: "unavailable" };

export function assessmentKindForFiling(kind: FilingKind): AssessmentKind {
  return kind === "original_return"
    ? "notice_of_assessment"
    : "notice_of_reassessment";
}

export function assertSubmittableCopyStatus(
  status: ReturnCopyStatus,
  documentLabel = "return copy",
) {
  if (status === "not_added_yet") {
    throw new Error(
      `Attach the ${documentLabel} or mark it unavailable before submitting.`,
    );
  }
}

export function assertSubmittedCopyStatus(
  status: ReturnCopyStatus,
  hasAttachment: boolean,
  documentLabel = "return",
) {
  if (status === "attached" && !hasAttachment) {
    throw new Error(`An attached ${documentLabel} must include a file.`);
  }
  if (status === "unavailable" && hasAttachment) {
    throw new Error(
      `Remove the attachment when the ${documentLabel} is unavailable.`,
    );
  }
}

export type TaxYearLifecycleWarning = {
  code: string;
  message: string;
};

export function buildTaxYearLifecycleWarnings(input: {
  targetStatus: TaxYearStatus;
  filings: ReadonlyArray<{
    kind: FilingKind;
    status: FilingStatus;
    hasAssessment: boolean;
  }>;
}): TaxYearLifecycleWarning[] {
  const warnings: TaxYearLifecycleWarning[] = [];
  const originalReturns = input.filings.filter(
    (filing) => filing.kind === "original_return",
  );
  const adjustments = input.filings.filter(
    (filing) => filing.kind === "adjustment",
  );

  if (input.targetStatus === "filed") {
    for (const filing of originalReturns) {
      if (filing.status === "preparing") {
        warnings.push({
          code: "original_return_incomplete",
          message:
            "At least one original return is still being prepared.",
        });
        break;
      }
    }
  }

  if (input.targetStatus === "assessed") {
    for (const filing of input.filings) {
      if (
        (filing.status === "submitted" || filing.status === "assessed") &&
        !filing.hasAssessment
      ) {
        warnings.push({
          code: "missing_assessment",
          message: "At least one submitted filing has no assessment yet.",
        });
        break;
      }
    }
  }

  if (input.targetStatus === "archived") {
    for (const adjustment of adjustments) {
      if (adjustment.status !== "assessed") {
        warnings.push({
          code: "open_adjustment",
          message: "At least one adjustment is still open.",
        });
        break;
      }
    }
  }

  return warnings;
}
