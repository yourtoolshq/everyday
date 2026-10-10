import { describe, expect, it } from "vitest";

import {
  clearUpdateInstallQuitPending,
  isUpdateInstallQuitPending,
  markUpdateInstallQuitPending,
} from "../electron/update-install-quit.js";

describe("update install quit flag", () => {
  it("tracks when an update-driven quit is pending", () => {
    clearUpdateInstallQuitPending();
    expect(isUpdateInstallQuitPending()).toBe(false);

    markUpdateInstallQuitPending();
    expect(isUpdateInstallQuitPending()).toBe(true);

    clearUpdateInstallQuitPending();
    expect(isUpdateInstallQuitPending()).toBe(false);
  });
});
