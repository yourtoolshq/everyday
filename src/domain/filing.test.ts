import { describe, expect, it } from "vitest";

import {
  assessmentKindForFiling,
  buildTaxYearLifecycleWarnings,
  originalReturnInput,
  originalReturnUpdateInput,
} from "./filing";

describe("filing domain", () => {
  it("allows an original return with an unavailable T1", () => {
    expect(
      originalReturnInput.parse({
        personId: 1,
        submissionDate: null,
        expectedResultCents: null,
        returnCopyStatus: "unavailable",
        notes: "Original copy no longer available.",
      }),
    ).toMatchObject({ returnCopyStatus: "unavailable" });
  });

  it("updates an original return without resubmitting personId", () => {
    expect(
      originalReturnUpdateInput.parse({
        submissionDate: "2024-04-15",
        expectedResultCents: 100_00,
        returnCopyStatus: "unavailable",
        notes: null,
        status: "submitted",
      }),
    ).toMatchObject({ status: "submitted" });
  });

  it("assigns NOA only to an original return", () => {
    expect(assessmentKindForFiling("original_return")).toBe(
      "notice_of_assessment",
    );
    expect(assessmentKindForFiling("adjustment")).toBe(
      "notice_of_reassessment",
    );
  });

  it("ignores persons with no filing history when moving to filed", () => {
    expect(
      buildTaxYearLifecycleWarnings({
        targetStatus: "filed",
        filings: [],
      }),
    ).toEqual([]);
  });

  it("warns when a submitted filing has no assessment before assessed", () => {
    expect(
      buildTaxYearLifecycleWarnings({
        targetStatus: "assessed",
        filings: [
          {
            kind: "original_return",
            status: "submitted",
            hasAssessment: false,
          },
        ],
      }),
    ).toEqual([
      {
        code: "missing_assessment",
        message: "At least one submitted filing has no assessment yet.",
      },
    ]);
  });
});
