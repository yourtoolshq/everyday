import { expect, test } from "@playwright/test";

test("foundation client completes setup against the real host", async ({
  page,
}) => {
  test.setTimeout(process.env.CI ? 90_000 : 60_000);

  await page.goto("/setup");
  await expect(
    page.getByRole("heading", { name: "Set up Passbook" }),
  ).toBeVisible();

  await page.getByLabel("Household label").fill("Foundation household");
  await page.getByLabel("Member 1 name").fill("Alex");
  await page.getByLabel("Member 2 name").fill("Jordan");
  await page.getByRole("button", { name: "Open Passbook" }).click();

  await expect(page).not.toHaveURL(/\/setup$/);
  await expect(
    page.getByRole("heading", { name: "Foundation household" }),
  ).toBeVisible({ timeout: 15_000 });
});
