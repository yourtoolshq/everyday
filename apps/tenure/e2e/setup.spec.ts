import { expect, test } from "@playwright/test";

test("setup flow creates a household", async ({ page }) => {
  await page.goto("/setup");
  await expect(
    page.getByRole("heading", { name: "Set up Tenure" }),
  ).toBeVisible();

  await page.getByLabel("Household label").fill("Test household");
  await page.getByLabel("Member 1 name").fill("Alex");
  await page.getByLabel("Member 2 name").fill("Jordan");
  await page.getByRole("button", { name: "Open Tenure" }).click();

  await expect(
    page.getByRole("heading", { name: "Test household" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "People", exact: true }),
  ).toBeVisible();
});
