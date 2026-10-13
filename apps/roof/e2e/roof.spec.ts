import { expect, test } from "@playwright/test";

test("property purchase, visit evidence, lifecycle, and rental history", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const suffix = testInfo.project.name;
  const name = `Cedar House ${suffix}`;
  await page.goto("/");
  await page.getByRole("button", { name: "Add property", exact: true }).click();
  await page.getByRole("button", { name: /Purchased home/ }).click();
  await page.getByLabel("Current stage").click();
  await page
    .getByRole("option", { name: "Under construction", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Property name").fill(name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByLabel("Lease starts", { exact: true }),
  ).not.toBeVisible();
  await page.getByLabel("Expected possession").fill("June 01, 2027");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Add property", exact: true })
    .last()
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Schedule visit" }).click();
  await page.getByLabel("Visit purpose").fill("Structure visit");
  await page.getByLabel("Date *", { exact: true }).fill("January 12, 2027");
  await page.getByLabel("Time (optional)").fill("14:30");
  await page
    .getByLabel("Notes (optional)", { exact: true })
    .fill("Check window locations and framing.");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(
    page.getByRole("heading", { name: "Structure visit" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Attach photo or document" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "visit-photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByText(/Uploaded$/)).toBeVisible();
  await page.getByLabel("Document title").fill("Framing photo");
  await page.getByLabel("Type", { exact: true }).selectOption("photo");
  await page.getByRole("button", { name: "Save document" }).click();
  await expect(page.getByText("Framing photo", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Framing photo", { exact: true })).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("link", { name: "Open Framing photo", exact: true })
    .click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(popup.url()).toContain("/api/data/files/");
  const original = await page.request.get(popup.url());
  expect(original.status()).toBe(200);
  expect(original.headers()["content-type"]).toContain("image/png");
  await popup.close();
  await page
    .getByRole("button", { name: "Edit Structure visit", exact: true })
    .click();
  await page.getByLabel("Status", { exact: true }).selectOption("completed");
  await page
    .getByLabel("Notes (optional)", { exact: true })
    .fill("Visited the structure. Window locations confirmed.");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(
    page.getByText("Visited the structure. Window locations confirmed."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit property", exact: true })
    .click();
  await page.getByLabel("Current stage").click();
  await page.getByRole("option", { name: "Owned", exact: true }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Purchased home · Owned", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Framing photo", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Structure visit", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Structure visit" }),
  ).not.toBeVisible();
  await expect(page.getByText("Framing photo", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Framing photo", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByText("Framing photo", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("link", { name: "All properties" }).click();
  await page.getByRole("button", { name: "Add property", exact: true }).click();
  await page.getByRole("button", { name: /^Rental/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Property name").fill(`Maple rental ${suffix}`);
  await page.locator('input[aria-label="Property photo"]').setInputFiles({
    name: "rental.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByText("Photo ready to save")).toBeVisible();
  await expect(page.getByAltText("Property photo preview")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByLabel("Expected possession", { exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByLabel("Insurance provider", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Move-in date", { exact: true })
    .fill("October 01, 2026");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Property name")).toHaveValue(
    `Maple rental ${suffix}`,
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Move-in date", { exact: true })).toHaveValue(
    "October 01, 2026",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Add property", exact: true })
    .last()
    .click();
  await expect(
    page.getByAltText(`Photo of Maple rental ${suffix}`),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByAltText(`Photo of Maple rental ${suffix}`),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add insurance", exact: true })
    .click();
  await page
    .getByLabel("Insurance provider", { exact: true })
    .fill("Fictional Insurance");
  await page.getByLabel("Policy number", { exact: true }).fill("DEMO-100");
  await page
    .getByRole("button", { name: "Save insurance", exact: true })
    .click();
  await expect(
    page.getByText("Fictional Insurance", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit property", exact: true })
    .click();
  await page.getByLabel("Rental status").click();
  await page.getByRole("option", { name: "Past rental", exact: true }).click();
  await page
    .getByLabel("Move-out date", { exact: true })
    .fill("September 30, 2027");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Rental · Past rental", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Rental · Past rental", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Tenant insurance · DEMO-100", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.evaluate(() => window.innerWidth),
  );
});

test("loads settings and reports a missing property", async ({ page }) => {
  await page.goto("/settings/data");
  await expect(
    page.getByRole("heading", { name: "Data & backups", level: 2 }),
  ).toBeVisible();
  await page.goto("/properties/00000000-0000-4000-8000-000000000000");
  await expect(
    page.getByRole("alert").filter({ hasText: "Property not found" }),
  ).toContainText("Property not found", {
    timeout: 15_000,
  });
});

test("keeps an unfinished property when cancelling close", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add property", exact: true }).click();
  await page.getByRole("button", { name: /^Rental/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Property name").fill("Draft rental");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByLabel("Property name")).toHaveValue("Draft rental");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("preserves relationship-specific drafts and stages when switching choices", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add property", exact: true }).click();
  await page.getByRole("button", { name: /Purchased home/ }).click();
  await page.getByLabel("Current stage").click();
  await page
    .getByRole("option", { name: "Under construction", exact: true })
    .click();
  await page.getByRole("button", { name: /^Rental/ }).click();
  await expect(page.getByLabel("Rental status")).toContainText(
    "Current rental",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Property name").fill("Switching draft");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Move-in date", { exact: true })
    .fill("October 01, 2026");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: /Purchased home/ }).click();
  await expect(page.getByLabel("Current stage")).toContainText(
    "Under construction",
  );
  await page.getByRole("button", { name: /^Rental/ }).click();
  await expect(page.getByLabel("Rental status")).toContainText(
    "Current rental",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Property name")).toHaveValue("Switching draft");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Move-in date", { exact: true })).toHaveValue(
    "October 01, 2026",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ready to add your property?" }),
  ).toBeVisible();
  await expect(
    page.getByText("Rental · Current rental", { exact: true }),
  ).toBeVisible();
});
