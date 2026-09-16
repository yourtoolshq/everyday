import { describe, expect, it } from "vitest";

import { deriveCareProgress } from "~/lib/visits";

describe("care goal progress", () => {
  it("derives progress from non-cancelled visits and the target", () => {
    expect(
      deriveCareProgress({ targetVisitCount: 2, notPursuingAt: null, visits: [] }),
    ).toMatchObject({ progress: "planned", completedVisitCount: 0, scheduledVisitCount: 0 });

    expect(
      deriveCareProgress({
        targetVisitCount: 2,
        notPursuingAt: null,
        visits: [{ status: "scheduled" }, { status: "cancelled" }],
      }),
    ).toMatchObject({ progress: "in_progress", completedVisitCount: 0, scheduledVisitCount: 1 });

    expect(
      deriveCareProgress({
        targetVisitCount: 2,
        notPursuingAt: null,
        visits: [{ status: "completed" }, { status: "completed" }],
      }),
    ).toMatchObject({ progress: "completed", completedVisitCount: 2 });
  });

  it("lets the manual not-pursuing state override visit progress", () => {
    expect(
      deriveCareProgress({
        targetVisitCount: 1,
        notPursuingAt: "2027-01-01T00:00:00.000Z",
        visits: [{ status: "completed" }],
      }).progress,
    ).toBe("not_pursuing");
  });
});
