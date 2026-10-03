import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveDesktopPaths } from "../electron/config";

describe("resolveDesktopPaths", () => {
  it("defaults to repo-local desktop test data", () => {
    const paths = resolveDesktopPaths({});
    expect(paths.root).toContain("apps/passbook");
    expect(paths.root).toBe(path.resolve(paths.hostCwd, ".."));
    expect(paths.hostUrl).toBe("http://127.0.0.1:3847");
    expect(paths.dataDir).toContain("desktop-test");
    expect(paths.clientDevUrl).toBe("http://127.0.0.1:5173");
  });
});
