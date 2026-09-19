import { describe, expect, it } from "vitest";

import {
  BASELINE_REQUIREMENT_KEY,
  buildEmploymentRecordRequirements,
  buildMissingEmploymentRecordItems,
  compensationChangeRequirementKey,
  deriveEmploymentRecordCompleteness,
} from "~/lib/employment-record-completeness";

const compensationChange = {
  id: "change-1",
  employmentId: "emp-1",
  type: "annual_salary" as const,
  currency: "CAD" as const,
  effectiveDate: "2024-06-01",
  amountCents: 90_000_00,
  commissionBasisPoints: null,
  notes: null,
  documentId: null,
  discussionId: null,
};

describe("employment record completeness", () => {
  it("flags a missing offer letter by default", () => {
    const result = deriveEmploymentRecordCompleteness([], {
      documents: [],
      documentsById: new Map(),
      exceptions: {},
    });

    expect(result.summary.missingCount).toBe(1);
    expect(result.requirements[0]).toMatchObject({
      key: BASELINE_REQUIREMENT_KEY,
      status: "missing",
    });
  });

  it("treats an uploaded offer letter as complete", () => {
    const result = deriveEmploymentRecordCompleteness([], {
      documents: [{ type: "offer_letter" }],
      documentsById: new Map([["doc-1", { type: "offer_letter" }]]),
      exceptions: {},
    });

    expect(result.summary.completeCount).toBe(1);
    expect(result.summary.missingCount).toBe(0);
  });

  it("requires a supporting document for each compensation change", () => {
    const requirements = buildEmploymentRecordRequirements([compensationChange]);
    expect(requirements).toHaveLength(2);
    expect(requirements[1]?.key).toBe(compensationChangeRequirementKey("change-1"));

    const missingDocument = deriveEmploymentRecordCompleteness([compensationChange], {
      documents: [{ type: "offer_letter" }],
      documentsById: new Map([["doc-1", { type: "offer_letter" }]]),
      exceptions: {},
    });
    expect(missingDocument.summary.missingCount).toBe(1);

    const withSalaryLetter = deriveEmploymentRecordCompleteness(
      [{ ...compensationChange, documentId: "doc-2" }],
      {
        documents: [{ type: "offer_letter" }, { type: "salary_letter" }],
        documentsById: new Map([
          ["doc-1", { type: "offer_letter" }],
          ["doc-2", { type: "salary_letter" }],
        ]),
        exceptions: {},
      },
    );
    expect(withSalaryLetter.summary.missingCount).toBe(0);
    expect(withSalaryLetter.summary.completeCount).toBe(2);
  });

  it("does not count a linked pay stub as supporting compensation evidence", () => {
    const result = deriveEmploymentRecordCompleteness(
      [{ ...compensationChange, documentId: "doc-2" }],
      {
        documents: [{ type: "offer_letter" }, { type: "pay_stub" }],
        documentsById: new Map([
          ["doc-1", { type: "offer_letter" }],
          ["doc-2", { type: "pay_stub" }],
        ]),
        exceptions: {},
      },
    );

    expect(result.summary.missingCount).toBe(1);
  });

  it("honors not-applicable exceptions", () => {
    const result = deriveEmploymentRecordCompleteness([], {
      documents: [],
      documentsById: new Map(),
      exceptions: { [BASELINE_REQUIREMENT_KEY]: true },
    });

    expect(result.summary.notApplicableCount).toBe(1);
    expect(result.summary.missingCount).toBe(0);
  });

  it("builds global missing items for review", () => {
    const missing = buildMissingEmploymentRecordItems(
      [
        {
          id: "emp-1",
          employerName: "Acme",
          personName: "Alex",
        },
      ],
      {
        "emp-1": {
          documents: [],
          documentsById: new Map(),
          compensationChanges: [compensationChange],
        },
      },
    );

    expect(missing).toHaveLength(2);
    expect(missing.map((item) => item.kind).sort()).toEqual(["compensation_change", "offer_letter"]);
  });
});
