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
  await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();

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

test("attaches, finds, edits, opens, and cascade-deletes visit documents", async ({ page, request }, testInfo) => {
  const suffix = testInfo.project.name === "mobile-chromium" ? "Mobile" : "Desktop";
  const documentTitle = `Visit receipt ${suffix}`;
  const updatedTitle = `Paid receipt ${suffix}`;

  await page.goto("/visits");
  await page.getByRole("link", { name: "View details" }).last().click();
  await page.getByRole("button", { name: "Add document" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("File").setInputFiles({
    name: `receipt-${suffix.toLowerCase()}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% First Aid test file\n"),
  });
  await dialog.getByLabel("Title").fill(documentTitle);
  await dialog.getByLabel("Document type").click();
  await page.getByRole("option", { name: "Receipt", exact: true }).click();
  await dialog.getByRole("button", { name: "Add document" }).click();
  await expect(page.getByRole("heading", { name: documentTitle })).toBeVisible();

  const openLink = page.getByRole("link", { name: "Open" });
  const fileResponse = await request.get((await openLink.getAttribute("href"))!);
  expect(fileResponse.ok()).toBe(true);
  expect(fileResponse.headers()["content-type"]).toBe("application/pdf");
  expect(fileResponse.headers()["cache-control"]).toBe("private, no-store");
  expect(fileResponse.headers()["x-content-type-options"]).toBe("nosniff");

  await page.getByLabel(`Edit ${documentTitle}`).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(updatedTitle);
  await dialog.getByLabel("Document type").click();
  await page.getByRole("option", { name: "Claim record" }).click();
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();

  await page.goto("/documents");
  await page.getByLabel("Search").fill(updatedTitle);
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  await page.getByLabel("Document type").click();
  await page.getByRole("option", { name: "Claim record" }).click();
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  await page.getByRole("link", { name: "View visit" }).click();

  await page.getByRole("button", { name: "Delete visit" }).click();
  const alert = page.getByRole("alertdialog");
  await expect(alert.getByText(/1 attached document/)).toBeVisible();
  await alert.getByRole("button", { name: "Delete visit and documents" }).click();
  await expect(page).toHaveURL(/\/visits$/);

  await page.goto("/documents");
  await page.getByLabel("Search").fill(updatedTitle);
  await expect(page.getByRole("heading", { name: updatedTitle })).toHaveCount(0);
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
  await expect(page.getByRole("link", { name: "Documents" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Benefits" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Claims" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Settings" })).toBeDisabled();
});

test("tracks benefits, visit costs, and claims", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const suffix = testInfo.project.name === "mobile-chromium" ? "Mobile" : "Desktop";
  const year = testInfo.project.name === "mobile-chromium" ? 2034 : 2033;
  const personName = `Benefits ${suffix}`;
  const careItemTitle = `Massage therapy ${suffix}`;
  const visitTitle = `Massage session ${suffix}`;

  await page.goto("/");
  if (await page.getByRole("heading", { name: "Who are you planning care for?" }).isVisible()) {
    await page.getByLabel("Display name").fill(personName);
    await page.getByRole("button", { name: "Continue" }).click();
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

  await page.goto("/benefits");
  await page.getByRole("button", { name: "Add plan" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Plan name").fill("Employer plan");
  await dialog.getByLabel("Year").fill(String(year));
  await dialog.getByRole("button", { name: "Add plan" }).click();
  await page.getByLabel("Benefit year").click();
  await page.getByRole("option", { name: String(year) }).click();
  await expect(page.getByRole("heading", { name: "Employer plan" })).toBeVisible();

  await page.getByRole("button", { name: "Add benefit" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Benefit name").fill("Massage therapy");
  await dialog.getByLabel("Annual limit").fill("500");
  await dialog.getByLabel("Opening used").fill("50");
  await dialog.getByRole("button", { name: "Add benefit" }).click();
  await expect(page.getByText("$450.00 remaining")).toBeVisible();

  const hsaName = `HSA ${suffix}`;
  await page.getByRole("button", { name: "Add benefit" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Benefit name").fill(hsaName);
  await dialog.getByLabel("Coverage").click();
  await page.getByRole("option", { name: "Shared by household" }).click();
  await dialog.getByLabel("Annual limit").fill("1000");
  await dialog.getByRole("button", { name: "Add benefit" }).click();
  await expect(page.getByText(hsaName)).toBeVisible();

  const clinicName = `Benefits Clinic ${year}`;
  await page.goto("/care-providers");
  await page.getByRole("button", { name: "Add organization" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(clinicName);
  await dialog.getByRole("button", { name: "Add organization" }).click();
  await expect(page.getByText(clinicName, { exact: true }).first()).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Add care item" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("What care should be considered?").fill(careItemTitle);
  await dialog.getByLabel("Category").click();
  await page.getByRole("option", { name: "Therapy and wellness" }).click();
  await dialog.getByRole("button", { name: "Add to plan" }).click();
  await expect(page.getByRole("heading", { name: careItemTitle })).toBeVisible();

  await page.goto("/visits");
  await page.getByRole("button", { name: "Record past visit" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Visit title or purpose").fill(visitTitle);
  await dialog.getByLabel("Care goal").click();
  await page.getByRole("option", { name: careItemTitle }).click();
  await dialog.getByLabel("Care organization").click();
  await page.getByRole("option", { name: clinicName }).click();
  await dialog.getByLabel("Appointment date and time").fill(`${year}-06-01T12:00`);
  await dialog.getByLabel("Total cost").fill("110");
  await dialog.getByRole("button", { name: "Record visit" }).click();
  await expect(page.getByRole("link", { name: visitTitle })).toBeVisible();

  await page.getByRole("link", { name: visitTitle }).click();
  await page.getByRole("button", { name: "Add claim" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Benefit").click();
  await page.getByRole("option", { name: /Massage therapy/ }).click();
  await dialog.getByLabel("Amount").fill("80");
  await dialog.getByRole("button", { name: "Add claim" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Add claim" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Benefit").click();
  await page.getByRole("option", { name: new RegExp(hsaName) }).click();
  await dialog.getByLabel("Amount").fill("20");
  await dialog.getByRole("button", { name: "Add claim" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText("Paid by benefits").locator("..").getByText("$100.00")).toBeVisible();
  await expect(page.getByText("Out of pocket").locator("..").getByText("$10.00")).toBeVisible();

  await page.goto("/benefits");
  await page.getByLabel("Benefit year").click();
  await page.getByRole("option", { name: String(year) }).click();
  await expect(page.getByText("$370.00 remaining")).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("$110.00 cost · $100.00 reimbursed · $10.00 out of pocket").first()).toBeVisible();
});

test("exposes a database-backed health check", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});
