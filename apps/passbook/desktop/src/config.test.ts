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

  it("keeps packaged backups outside the packaged data directory", () => {
    const paths = resolveDesktopPaths({
      PASSBOOK_PACKAGED: "1",
      PASSBOOK_ROOT: "/Applications/Passbook.app/Contents/Resources/passbook",
      PASSBOOK_USER_DATA_DIR:
        "/Users/example/Library/Application Support/Passbook",
    });

    expect(paths.dataDir).toBe(
      "/Users/example/Library/Application Support/Passbook/data",
    );
    expect(paths.backupDir).toBe(
      "/Users/example/Library/Application Support/Passbook/backups",
    );
  });
});
