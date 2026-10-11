import { describe, expect, it } from "vitest";

import {
  assertDeveloperIdApplication,
  classifyDeveloperIdSignature,
  readCodesignDetails,
} from "./verify-mac-release-signing.cjs";

describe("classifyDeveloperIdSignature", () => {
  it("detects Developer ID Application signatures", () => {
    expect(
      classifyDeveloperIdSignature(
        "Authority=Developer ID Application: Example Dev (TEAMID)\nTeamIdentifier=TEAMID",
      ),
    ).toBe("developer-id");
  });

  it("detects ad-hoc signatures", () => {
    expect(
      classifyDeveloperIdSignature("Signature=adhoc\nTeamIdentifier=not set"),
    ).toBe("adhoc");
  });
});

describe("readCodesignDetails", () => {
  it("uses stderr output from codesign -dv on success", () => {
    const calls = [];
    const runCommand = (command, args) => {
      calls.push([command, args]);
      if (command === "codesign" && args[0] === "--verify") {
        return { status: 0, stdout: "", stderr: "" };
      }
      if (command === "codesign" && args[0] === "-dv") {
        return {
          status: 0,
          stdout: "",
          stderr:
            "Authority=Developer ID Application: Example Dev (TEAMID)\nSignature=Developer ID Application: Example Dev (TEAMID)",
        };
      }
      return { status: 1, stdout: "", stderr: "unexpected" };
    };

    const details = readCodesignDetails("/tmp/Passbook.app", runCommand);
    expect(details).toMatch(/Developer ID Application/);
    expect(calls).toHaveLength(2);
    assertDeveloperIdApplication(details);
  });

  it("fails verify when codesign -dv returns no signature details", () => {
    const runCommand = (command, args) => {
      if (command === "codesign" && args[0] === "--verify") {
        return { status: 0, stdout: "", stderr: "" };
      }
      return { status: 0, stdout: "", stderr: "" };
    };
    expect(() => readCodesignDetails("/tmp/Passbook.app", runCommand)).toThrow(
      /no signature details/,
    );
  });
});
