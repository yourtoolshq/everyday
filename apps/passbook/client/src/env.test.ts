import { describe, expect, it } from "vitest";

import { getHostUrl } from "./lib/host";

describe("getHostUrl", () => {
  it("defaults to the foundation host port", () => {
    expect(getHostUrl()).toBe("http://127.0.0.1:3847");
  });
});
