import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import {
  libsqlNativePackage,
  resolveLibsqlNativeRuntime,
} from "./native-runtime.mjs";

const require = createRequire(import.meta.url);

describe("bundled libsql native runtime", () => {
  it.each([
    ["linux-x64-gnu", "glibc", "@libsql/linux-x64-gnu"],
    ["linux-arm64-gnu", "glibc", "@libsql/linux-arm64-gnu"],
    ["linux-x64-musl", "musl", "@libsql/linux-x64-musl"],
    ["linux-arm64-musl", "musl", "@libsql/linux-arm64-musl"],
    ["linux-x64-musl", "glibc", "@libsql/linux-x64-gnu"],
    ["linux-arm64-musl", "glibc", "@libsql/linux-arm64-gnu"],
    ["darwin-arm64", null, "@libsql/darwin-arm64"],
    ["win32-x64-msvc", null, "@libsql/win32-x64-msvc"],
  ])("selects %s on %s", (target, family, expected) => {
    expect(libsqlNativePackage(target, family, "glibc")).toBe(expected);
  });

  it("resolves the installed runtime through libsql's dependency boundary", () => {
    const runtime = resolveLibsqlNativeRuntime(
      require.resolve("@libsql/client"),
    );
    expect(runtime.entry).toContain(runtime.packageName);
    expect(() => require(runtime.entry)).not.toThrow();
  });
});
