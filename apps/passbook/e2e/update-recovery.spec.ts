import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function mockFailedDesktopUpdate(page: Page) {
  await page.addInitScript(() => {
    type MockUpdateState = {
      enabled: boolean;
      status: string;
      currentVersion: string;
      availableVersion: string | null;
      downloadedVersion: string | null;
      releaseNotes: unknown[];
      downloadPercent: number | null;
      message: string | null;
      errorContext: string | null;
      dismissed: boolean;
      trial: {
        targetVersion: string;
        previousVersion: string;
        backupId: string;
        status: "failed";
        failureReason: string;
      } | null;
    };
    let state: MockUpdateState = {
      enabled: true,
      status: "idle",
      currentVersion: "0.1.0",
      availableVersion: null,
      downloadedVersion: null,
      releaseNotes: [],
      downloadPercent: null,
      message: null,
      errorContext: null,
      dismissed: false,
      trial: {
        targetVersion: "0.1.1",
        previousVersion: "0.1.0",
        backupId: "",
        status: "failed",
        failureReason:
          "Passbook could not create a verified backup before updating.",
      },
    };
    const listeners: Array<(next: MockUpdateState) => void> = [];
    let dismissCount = 0;

    const failedAction = () =>
      Promise.resolve({ accepted: false, completed: false, state });

    Object.assign(window, {
      passbookDesktop: {
        hostUrl: "http://127.0.0.1:3100",
        updates: {
          getState: () => Promise.resolve(state),
          subscribe: (listener: (next: MockUpdateState) => void) => {
            listeners.push(listener);
            return () => {
              const index = listeners.indexOf(listener);
              if (index >= 0) listeners.splice(index, 1);
            };
          },
          checkForUpdates: failedAction,
          downloadUpdate: failedAction,
          installUpdate: failedAction,
          dismissUpdate: () => Promise.resolve(state),
          commitTrial: failedAction,
          markTrialFailed: failedAction,
          dismissTrialFailure: () => {
            dismissCount += 1;
            state = { ...state, trial: null };
            for (const listener of listeners) listener(state);
            return Promise.resolve({ accepted: true, completed: true, state });
          },
        },
      },
      getPassbookDismissCount: () => dismissCount,
    });
  });
}

test("a failed backup checkpoint can be dismissed so Passbook is usable", async ({
  page,
}) => {
  await mockFailedDesktopUpdate(page);
  await page.goto("/");

  await expect(page.getByText("Update could not be verified")).toBeVisible();
  await expect(
    page.getByText(
      "No update was installed, and your existing Passbook data was left in place.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Continue to Passbook" }).click();

  await expect(page.getByText("Update could not be verified")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as typeof window & { getPassbookDismissCount: () => number }
        ).getPassbookDismissCount(),
      ),
    )
    .toBe(1);
});

test("Data & backups clears the blocker before leaving update recovery", async ({
  page,
}) => {
  await mockFailedDesktopUpdate(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Open Data & backups" }).click();

  await expect(page).toHaveURL(/\/settings\/data$/);
  await expect(page.getByText("Update could not be verified")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as typeof window & { getPassbookDismissCount: () => number }
        ).getPassbookDismissCount(),
      ),
    )
    .toBe(1);
});
