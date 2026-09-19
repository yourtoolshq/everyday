import { formatCompensationRate, type CompensationChangeRecord } from "~/lib/compensation";
import { documentTypeLabels, formatDateLabel, type DocumentType } from "~/lib/documents";

export const BASELINE_REQUIREMENT_KEY = "offer_letter";

export type EmploymentRecordCompletenessStatus = "complete" | "missing" | "not_applicable";

export type EmploymentRecordRequirement = {
  key: string;
  kind: "offer_letter" | "compensation_change";
  label: string;
  compensationChangeId?: string;
  effectiveDate?: string;
};

export type EmploymentRecordRequirementStatus = EmploymentRecordRequirement & {
  status: EmploymentRecordCompletenessStatus;
};

export type MissingEmploymentRecordItem = {
  employmentId: string;
  employerName: string;
  personName: string;
  requirementKey: string;
  label: string;
  kind: EmploymentRecordRequirement["kind"];
  compensationChangeId?: string;
};

export type EmploymentRecordCompletenessSummary = {
  expectedCount: number;
  completeCount: number;
  notApplicableCount: number;
  missingCount: number;
};

export const employmentRecordCompletenessLabels: Record<
  EmploymentRecordCompletenessStatus,
  string
> = {
  complete: "On file",
  missing: "Missing",
  not_applicable: "Not applicable",
};

export function compensationChangeRequirementKey(changeId: string): string {
  return `compensation_change:${changeId}`;
}

export function parseRequirementKey(
  key: string,
): { kind: "offer_letter" } | { kind: "compensation_change"; changeId: string } | null {
  if (key === BASELINE_REQUIREMENT_KEY) return { kind: "offer_letter" };
  if (key.startsWith("compensation_change:")) {
    return {
      kind: "compensation_change",
      changeId: key.slice("compensation_change:".length),
    };
  }
  return null;
}

type DocumentForCompleteness = {
  type: DocumentType;
};

type CompensationChangeForCompleteness = CompensationChangeRecord;

export function buildEmploymentRecordRequirements(
  compensationChanges: CompensationChangeForCompleteness[],
): EmploymentRecordRequirement[] {
  const requirements: EmploymentRecordRequirement[] = [
    {
      key: BASELINE_REQUIREMENT_KEY,
      kind: "offer_letter",
      label: documentTypeLabels.offer_letter,
    },
  ];

  for (const change of compensationChanges) {
    const rateLabel = formatCompensationRate(change);
    const dateLabel = formatDateLabel(change.effectiveDate) ?? change.effectiveDate;
    requirements.push({
      key: compensationChangeRequirementKey(change.id),
      kind: "compensation_change",
      label: `Supporting document for ${rateLabel} (${dateLabel})`,
      compensationChangeId: change.id,
      effectiveDate: change.effectiveDate,
    });
  }

  return requirements;
}

function hasOfferLetter(documents: DocumentForCompleteness[]): boolean {
  return documents.some((document) => document.type === "offer_letter");
}

function compensationChangeHasSupportingDocument(
  change: CompensationChangeForCompleteness,
  documentsById: ReadonlyMap<string, DocumentForCompleteness>,
): boolean {
  if (!change.documentId) return false;
  const document = documentsById.get(change.documentId);
  return Boolean(document && document.type !== "pay_stub");
}

export function deriveRequirementStatus(
  requirement: EmploymentRecordRequirement,
  input: {
    documents: DocumentForCompleteness[];
    documentsById: ReadonlyMap<string, DocumentForCompleteness>;
    compensationChangesById: ReadonlyMap<string, CompensationChangeForCompleteness>;
    exceptions: Readonly<Record<string, true>>;
  },
): EmploymentRecordCompletenessStatus {
  if (input.exceptions[requirement.key]) return "not_applicable";

  if (requirement.kind === "offer_letter") {
    return hasOfferLetter(input.documents) ? "complete" : "missing";
  }

  const changeId = requirement.compensationChangeId;
  if (!changeId) return "missing";

  const change = input.compensationChangesById.get(changeId);
  if (!change) return "missing";

  return compensationChangeHasSupportingDocument(change, input.documentsById)
    ? "complete"
    : "missing";
}

export function deriveEmploymentRecordCompleteness(
  compensationChanges: CompensationChangeForCompleteness[],
  input: {
    documents: DocumentForCompleteness[];
    documentsById: ReadonlyMap<string, DocumentForCompleteness>;
    exceptions: Readonly<Record<string, true>>;
  },
): {
  requirements: EmploymentRecordRequirementStatus[];
  summary: EmploymentRecordCompletenessSummary;
} {
  const compensationChangesById = new Map(
    compensationChanges.map((change) => [change.id, change]),
  );
  const requirements = buildEmploymentRecordRequirements(compensationChanges).map(
    (requirement) => ({
      ...requirement,
      status: deriveRequirementStatus(requirement, {
        documents: input.documents,
        documentsById: input.documentsById,
        compensationChangesById,
        exceptions: input.exceptions,
      }),
    }),
  );

  let completeCount = 0;
  let notApplicableCount = 0;
  let missingCount = 0;

  for (const requirement of requirements) {
    if (requirement.status === "complete") completeCount += 1;
    if (requirement.status === "not_applicable") notApplicableCount += 1;
    if (requirement.status === "missing") missingCount += 1;
  }

  return {
    requirements,
    summary: {
      expectedCount: requirements.length,
      completeCount,
      notApplicableCount,
      missingCount,
    },
  };
}

export type EmploymentForRecordReview = {
  id: string;
  employerName: string;
  personName: string;
};

export type RecordExceptionsByEmployment = Readonly<
  Record<string, Readonly<Record<string, true>>>
>;

export function buildRecordExceptionsByEmployment(
  rows: ReadonlyArray<{ employmentId: string; requirementKey: string }>,
): RecordExceptionsByEmployment {
  const exceptionsByEmployment: Record<string, Record<string, true>> = {};

  for (const row of rows) {
    const employmentExceptions = exceptionsByEmployment[row.employmentId] ?? {};
    employmentExceptions[row.requirementKey] = true;
    exceptionsByEmployment[row.employmentId] = employmentExceptions;
  }

  return exceptionsByEmployment;
}

export function buildMissingEmploymentRecordItems(
  employments: EmploymentForRecordReview[],
  dataByEmployment: Readonly<
    Record<
      string,
      {
        documents: DocumentForCompleteness[];
        documentsById: ReadonlyMap<string, DocumentForCompleteness & { id: string }>;
        compensationChanges: CompensationChangeForCompleteness[];
      }
    >
  >,
  exceptionsByEmployment: RecordExceptionsByEmployment = {},
): MissingEmploymentRecordItem[] {
  const missing: MissingEmploymentRecordItem[] = [];

  for (const employment of employments) {
    const data = dataByEmployment[employment.id];
    if (!data) continue;

    const { requirements } = deriveEmploymentRecordCompleteness(data.compensationChanges, {
      documents: data.documents,
      documentsById: data.documentsById,
      exceptions: exceptionsByEmployment[employment.id] ?? {},
    });

    for (const requirement of requirements) {
      if (requirement.status !== "missing") continue;
      missing.push({
        employmentId: employment.id,
        employerName: employment.employerName,
        personName: employment.personName,
        requirementKey: requirement.key,
        label: requirement.label,
        kind: requirement.kind,
        compensationChangeId: requirement.compensationChangeId,
      });
    }
  }

  return missing.sort((left, right) => {
    const byEmployer = left.employerName.localeCompare(right.employerName);
    if (byEmployer !== 0) return byEmployer;
    const byKind = left.kind.localeCompare(right.kind);
    if (byKind !== 0) return byKind;
    return left.label.localeCompare(right.label);
  });
}
