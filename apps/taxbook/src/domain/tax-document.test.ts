import { describe, expect, it } from "vitest";

import {
  buildTaxDocumentReadiness,
  taxDocumentInput,
} from "./tax-document";

describe("Tax Documents", () => {
  it("requires a custom name only for Other documents", () => {
    const base = {
      taxItemId: 1,
      issuer: "Example issuer",
      personId: null,
      notes: null,
    };
    expect(
      taxDocumentInput.safeParse({ ...base, type: "other", customTypeName: null }).success,
    ).toBe(false);
    expect(
      taxDocumentInput.safeParse({ ...base, type: "t4", customTypeName: "T4A" }).success,
    ).toBe(false);
    expect(
      taxDocumentInput.safeParse({ ...base, type: "other", customTypeName: "T4A" }).success,
    ).toBe(true);
  });

  it("reports readiness only when tracked documents are ready or used", () => {
    expect(buildTaxDocumentReadiness([])).toMatchObject({ total: 0, isReady: false });
    expect(buildTaxDocumentReadiness([{ status: "received" }, { status: "ready" }])).toMatchObject({
      total: 2,
      isReady: false,
      counts: { expected: 0, received: 1, ready: 1, used: 0 },
    });
    expect(buildTaxDocumentReadiness([{ status: "ready" }, { status: "used" }])).toMatchObject({
      total: 2,
      isReady: true,
    });
  });
});
