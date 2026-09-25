import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PlatformStatus } from "@yourtoolshq/data";

import { DataGate } from "./data-gate";
import { MaintenanceScreen } from "./maintenance-screen";

const base = { app: "passbook", version: "0.88.0" };

function render(status: PlatformStatus) {
  return renderToStaticMarkup(<MaintenanceScreen initialStatus={status} />);
}

describe("DataGate", () => {
  it("renders its children when the data is ready", async () => {
    const platform = {
      status: () => Promise.resolve({ ...base, state: "ready" as const }),
    };
    const html = renderToStaticMarkup(
      await DataGate({ platform, children: <p>Accounts</p> }),
    );
    expect(html).toBe("<p>Accounts</p>");
  });

  it("renders the maintenance screen instead of its children otherwise", async () => {
    const platform = {
      status: () => Promise.resolve({ ...base, state: "restoring" as const }),
    };
    const html = renderToStaticMarkup(
      await DataGate({ platform, children: <p>Accounts</p> }),
    );
    expect(html).not.toContain("Accounts");
    expect(html).toContain("Restoring a backup");
  });
});

describe("MaintenanceScreen", () => {
  it("shows the backup step of an upgrade", () => {
    const html = render({
      ...base,
      state: "upgrading",
      step: "backup",
      migrations: ["0011_budgets"],
    });
    expect(html).toContain("Upgrading your data");
    expect(html).toContain("Backing up your data before the update.");
  });

  it("counts the migrations being applied", () => {
    const html = render({
      ...base,
      state: "upgrading",
      step: "migrate",
      migrations: ["0011_budgets", "0012_goals"],
    });
    expect(html).toContain("Applying 2 updates.");
  });

  it("lists the backups a blocked version can restore", () => {
    const html = render({
      ...base,
      state: "blocked",
      reason: "downgrade",
      message: "The database has migrations this version does not know.",
      restorableBackups: [
        {
          id: "passbook-2026-09-23T02-00-00Z",
          createdAt: "2026-09-23T02:00:00.000Z",
          appVersion: "0.87.2",
          trigger: "scheduled",
        },
      ],
    });
    expect(html).toContain("This data needs a newer version");
    expect(html).toContain(
      "The database has migrations this version does not know.",
    );
    expect(html).toContain("Sep 23, 2026, 2:00 AM UTC");
    expect(html).toContain("scheduled · made by 0.87.2");
    expect(html).toContain("Restore</button>");
  });

  it("says when no backup can be restored", () => {
    const html = render({
      ...base,
      state: "blocked",
      reason: "edited-migration",
      message: "Migration 0004_sources was edited after it was applied.",
      restorableBackups: [],
    });
    expect(html).toContain("This data does not match this version");
    expect(html).toContain("No backup this version can open was found.");
  });

  it("points a failed upgrade to the previous version without offering restores", () => {
    const html = render({
      ...base,
      state: "blocked",
      reason: "migration-failed",
      message: "Migration 0011_budgets failed: no such table: budgets",
    });
    expect(html).toContain("The upgrade failed");
    expect(html).toContain("Run the previous version.");
    expect(html).not.toContain("Restore</button>");
  });
});
