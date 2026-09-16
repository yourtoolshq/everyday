import { expect, test } from "@playwright/test";

test("plans a healthcare year and manages care items", async ({ page }, testInfo) => {
  const year = testInfo.project.name === "mobile-chromium" ? 2032 : 2031;
  await page.goto("/");

  const firstPersonHeading = page.getByRole("heading", {
    name: "Who are you planning care for?",
  });
  if (await firstPersonHeading.isVisible()) {
    await page.getByLabel("Display name").fill("Test Person");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Create your healthcare year" })).toBeVisible();
    await page.getByLabel("Plan year").fill(String(year));
    await page.getByRole("button", { name: "Create care plan" }).click();
  } else if (await page.getByRole("heading", { name: "Create your healthcare year" }).isVisible()) {
    await page.getByLabel("Plan year").fill(String(year));
    await page.getByRole("button", { name: "Create care plan" }).click();
  } else {
    await page.getByRole("button", { name: "New year" }).click();
    await page.getByRole("dialog").getByLabel("Plan year").fill(String(year));
    await page.getByRole("dialog").getByRole("button", { name: "Create plan" }).click();
  }

  await expect(page.getByRole("heading", { name: `${year} care plan` })).toBeVisible();
  await expect(page.getByText("Nothing planned yet").first()).toBeVisible();

  await page.getByRole("button", { name: "Add care item" }).first().click();
  const itemDialog = page.getByRole("dialog");
  await itemDialog.getByLabel("What care should be considered?").fill("Dental cleaning");
  await itemDialog.getByLabel("Category").click();
  await page.getByRole("option", { name: "Dental", exact: true }).click();
  await itemDialog.getByLabel("Target visits").fill("1");
  await itemDialog.getByLabel("Cadence").click();
  await page.getByRole("option", { name: "Yearly", exact: true }).click();
  await itemDialog.getByLabel("Timing").click();
  await page.getByRole("option", { name: "Month", exact: true }).click();
  await itemDialog.getByLabel("Target month").click();
  await page.getByRole("option", { name: "September", exact: true }).click();
  await itemDialog.getByLabel("Source or reason").click();
  await page.getByRole("option", { name: "Preventive care", exact: true }).click();
  await itemDialog.getByLabel("Source detail").fill("Routine household care");
  await itemDialog.getByRole("button", { name: "Add to plan" }).click();

  await expect(page.getByRole("heading", { name: "Dental cleaning" })).toBeVisible();
  await expect(page.getByText("September")).toBeVisible();
  await expect(page.getByText("0 of 1 visit completed")).toBeVisible();

  await page.getByLabel("Edit Dental cleaning").click();
  await itemDialog.getByLabel("What care should be considered?").fill("Dental exam and cleaning");
  await itemDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Dental exam and cleaning" })).toBeVisible();

  await page.getByLabel("Delete Dental exam and cleaning").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete item" }).click();
  await expect(page.getByRole("heading", { name: "Dental exam and cleaning" })).toHaveCount(0);
});

test("manages providers and derives care progress from visits", async ({ page }, testInfo) => {
  const suffix = testInfo.project.name === "mobile-chromium" ? "Mobile" : "Desktop";
  const organizationName = `Example Wellness ${suffix}`;
  const providerName = `Example Therapist ${suffix}`;

  await page.goto("/care-providers");
  await page.getByRole("button", { name: "Add organization" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(organizationName);
  await dialog.getByLabel("Phone numbers").fill("555-0100\n555-0101");
  await dialog.getByRole("button", { name: "Add organization" }).click();
  await expect(page.getByText(organizationName, { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Add provider" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Provider name").fill(providerName);
  await dialog.getByLabel("Care organization").click();
  await page.getByRole("option", { name: organizationName }).click();
  await dialog.getByRole("button", { name: "Add provider" }).click();
  await expect(page.getByText(providerName, { exact: true })).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Add care item" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("What care should be considered?").fill("Massage therapy goal");
  await dialog.getByLabel("Target visits").fill("2");
  await dialog.getByLabel("Category").click();
  await page.getByRole("option", { name: "Therapy and wellness" }).click();
  await dialog.getByRole("button", { name: "Add to plan" }).click();
  await expect(page.getByText("0 of 2 visits completed")).toBeVisible();

  await page.getByRole("button", { name: "Schedule", exact: true }).last().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Provider").click();
  await page.getByRole("option", { name: providerName }).click();
  await dialog.getByLabel("Appointment date and time").fill("2035-05-12T10:30");
  await dialog.getByRole("button", { name: "Schedule visit" }).click();
  await expect(page.getByText("1 scheduled")).toBeVisible();
  await expect(page.getByText("In progress")).toBeVisible();

  await page.goto("/visits");
  await page.getByLabel("Provider or organization").click();
  await page.getByRole("option", { name: providerName }).click();
  await expect(page.getByRole("heading", { name: "Massage therapy goal" })).toBeVisible();
  await page.getByRole("button", { name: "Complete" }).click();
  await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("1 of 2 visits completed")).toBeVisible();
  await page.getByRole("button", { name: "Record", exact: true }).last().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Care organization").click();
  await page.getByRole("option", { name: organizationName }).click();
  await dialog.getByLabel("Appointment date and time").fill("2035-08-14T14:00");
  await dialog.getByRole("button", { name: "Record visit" }).click();
  await expect(page.getByText("2 of 2 visits completed")).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();

  await page.goto("/visits");
  await page.getByRole("button", { name: "Record past visit" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Visit title or purpose").fill("Unplanned lab visit");
  await dialog.getByLabel("Care organization").click();
  await page.getByRole("option", { name: organizationName }).click();
  await dialog.getByLabel("Appointment date and time").fill("2035-09-20T09:15");
  await dialog.getByRole("button", { name: "Record visit" }).click();
  await expect(page.getByRole("heading", { name: "Unplanned lab visit" }).first()).toBeVisible();
});

test("manages household members safely", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Household", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Add a household member").fill("Second Person");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByText("Second Person", { exact: true })).toBeVisible();
  await dialog.getByLabel("Rename Second Person").click();
  await dialog.locator('input[name="displayName"]').first().fill("Household Member");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("Household Member", { exact: true })).toBeVisible();
  await dialog.getByLabel("Delete Household Member").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete person" }).click();
  await expect(dialog.getByText("Household Member", { exact: true })).toHaveCount(0);
});

test("renders the responsive private application shell", async ({ page }, testInfo) => {
  await page.goto("/");
  const privacy = page.getByText("Private · Stored locally");
  if (testInfo.project.name === "mobile-chromium") await expect(privacy).toBeHidden();
  else await expect(privacy).toBeVisible();

  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  if (testInfo.project.name === "mobile-chromium") {
    await expect(page.getByRole("dialog")).toBeVisible();
  }
  await expect(page.getByText("First Aid", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Care Plan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Visits" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Care Providers" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Documents" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Benefits" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Claims" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Settings" })).toBeDisabled();
});

test("exposes a database-backed health check", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});
