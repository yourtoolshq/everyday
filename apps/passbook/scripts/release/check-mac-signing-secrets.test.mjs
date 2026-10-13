import { describe, expect, it } from "vitest";

import {
  assertMacSigningSecretsPresent,
  findMissingMacSigningSecrets,
} from "./check-mac-signing-secrets.cjs";

describe("check-mac-signing-secrets", () => {
  it("reports missing secret names without echoing values", () => {
    expect(
      findMissingMacSigningSecrets({
        MAC_CSC_LINK: "present",
        MAC_CSC_KEY_PASSWORD: "",
        APPLE_ID: "user@example.com",
        APPLE_APP_SPECIFIC_PASSWORD: "abcd",
        APPLE_TEAM_ID: "TEAM123",
      }),
    ).toEqual(["MAC_CSC_KEY_PASSWORD"]);
  });

  it("throws when any required secret is absent", () => {
    expect(() =>
      assertMacSigningSecretsPresent({
        MAC_CSC_LINK: "base64-data",
        MAC_CSC_KEY_PASSWORD: "secret",
        APPLE_ID: "user@example.com",
        APPLE_APP_SPECIFIC_PASSWORD: "abcd",
        APPLE_TEAM_ID: undefined,
      }),
    ).toThrow(/APPLE_TEAM_ID/);
  });
});
