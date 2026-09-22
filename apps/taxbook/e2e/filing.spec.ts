import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

async function setupHousehold(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);
  await page.getByLabel("Household label").fill("Example household");
  await page.getByLabel("Person 1 name").fill("Person A");
  await page.getByLabel("Person 2 name").fill("Person B");
  await page.getByLabel("Starting tax year").fill("2026");
  await page.getByRole("button", { name: "Open Tax Book" }).click();
  await expect(
    page.getByRole("heading", { name: "Example household" }),
  ).toBeVisible();
}

test("backfills a past year with NOA and protects archived tracked data", async ({
  page,
}) => {
  await setupHousehold(page);

  await page.getByRole("button", { name: "Tax year" }).click();
  await page.getByRole("menuitem", { name: "New tax year" }).click();
  await page.getByLabel("Purpose").click();
  await page.getByRole("option", { name: "Add a past year" }).click();
  await page.getByLabel("Calendar year").fill("2023");
  await page.getByRole("button", { name: "Add past year" }).click();
  await expect(page.getByText("Past tax year added.")).toBeVisible();

  const switchYearReload = page.waitForEvent("load");
  await page.getByRole("button", { name: "Tax year" }).click();
  await page.getByRole("menuitem", { name: "2023" }).click();
  await switchYearReload;

  await page.getByRole("link", { name: "Tax Filing", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tax Filing" })).toBeVisible();
  await page.getByRole("button", { name: "Add return" }).first().click();
  await page.getByLabel("Submitted T1").click();
  await page.getByRole("option", { name: "Unavailable" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Original return added.")).toBeVisible();

  await page.getByRole("button", { name: "Add NOA" }).click();
  await page.getByLabel("Assessment date").fill("2024-05-01");
  await page.getByLabel("Assessed result").click();
  await page.getByRole("option", { name: "Refund" }).click();
  await page.getByLabel("Amount").fill("1250");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Assessment added.")).toBeVisible();
  await expect(page.getByText("$1,250.00")).toBeVisible();

  await page.getByText("Lifecycle").locator("..").getByRole("combobox").click();
  await page.getByRole("option", { name: "Archived" }).click();
  await expect(page.getByText("Tax year status updated.")).toBeVisible();

  await page.getByRole("link", { name: "Tax Items", exact: true }).click();
  await page.getByRole("button", { name: "Add tax item" }).first().click();
  await page.getByLabel("Name").fill("Blocked item");
  await page.getByRole("button", { name: "Add tax item" }).last().click();
  await expect(page.getByText("archived", { exact: false })).toBeVisible();
});

test("confirms lifecycle warnings before marking a year filed", async ({
  page,
}) => {
  await setupHousehold(page);

  await page.getByRole("link", { name: "Tax Filing", exact: true }).click();
  await page.getByRole("button", { name: "Add return" }).first().click();
  await page.getByLabel("Submitted T1").click();
  await page.getByRole("option", { name: "Unavailable" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Original return added.")).toBeVisible();

  await page.getByText("Lifecycle").locator("..").getByRole("combobox").click();
  await page.getByRole("option", { name: "Filed" }).click();
  await expect(
    page.getByRole("heading", { name: "Change lifecycle to Filed?" }),
  ).toBeVisible();
  await expect(page.getByText("still being prepared")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByRole("heading", { name: "Change lifecycle to Filed?" }),
  ).toHaveCount(0);

  await page.getByText("Lifecycle").locator("..").getByRole("combobox").click();
  await page.getByRole("option", { name: "Filed" }).click();
  await page.getByRole("button", { name: "Continue anyway" }).click();
  await expect(page.getByText("warnings acknowledged")).toBeVisible();
});
