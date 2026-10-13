import { expect, test } from "@playwright/test";

test("keeps lease history, originals, overlap warnings, and explicit continuation", async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.clock.setFixedTime(new Date("2026-10-12T12:00:00"));
  await page.goto("/");
  await page.getByRole("button", { name: "Add property", exact: true }).click();
  await page.getByRole("button", { name: /^Rental/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Property name")
    .fill(`Maple Court ${info.project.name}`);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Add property", exact: true })
    .last()
    .click();
  await expect(page.getByText("No active lease recorded")).toBeVisible();
  async function lease(title: string, start: string, end?: string) {
    await page.getByRole("button", { name: "Add lease", exact: true }).click();
    await page.getByLabel("Lease title").fill(title);
    if (!end) await page.getByLabel("Term type").selectOption("month_to_month");
    await page.getByLabel("Lease starts (optional)").fill(start);
    if (end) await page.getByLabel("Lease ends (optional)").fill(end);
    await page.getByRole("button", { name: "Save lease", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  await lease("Original lease", "October 01, 2025", "September 30, 2026");
  await lease("Annual renewal", "October 01, 2026", "September 30, 2027");
  const renewal = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Annual renewal", exact: true }),
  });
  await expect(renewal.getByText("Active", { exact: true })).toBeVisible();
  await renewal.getByRole("button", { name: "Attach lease document" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "confirmation.eml",
    mimeType: "message/rfc822",
    buffer: Buffer.from(
      "From: example@example.invalid\r\nSubject: Renewal confirmation\r\n\r\nFictional confirmation.",
    ),
  });
  await expect(page.getByText(/Uploaded$/)).toBeVisible();
  await page.getByLabel("Document title").fill("Renewal confirmation");
  await page.getByLabel("Type", { exact: true }).selectOption("correspondence");
  await page.getByRole("button", { name: "Save document" }).click();
  await expect(
    renewal.getByText("Renewal confirmation", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    renewal.getByText("Renewal confirmation", { exact: true }),
  ).toBeVisible();
  const fileLink = renewal.getByRole("link", {
    name: "Open Renewal confirmation",
    exact: true,
  });
  const href = (await fileLink.getAttribute("href"))!;
  const popupPromise = page.waitForEvent("popup");
  await fileLink.click();
  const popup = await popupPromise;
  await expect(
    popup.getByText("Fictional confirmation.", { exact: true }),
  ).toBeVisible();
  await popup.close();
  const original = await page.request.get(
    href.replace("/files/", "/api/data/files/"),
  );
  expect(original.status()).toBe(200);
  expect(await original.text()).toContain("Fictional confirmation.");
  await page
    .getByRole("button", { name: "Edit Renewal confirmation", exact: true })
    .click();
  await page
    .getByLabel("Lease (optional)")
    .selectOption({ label: "Original lease" });
  await page.getByRole("button", { name: "Save document" }).click();
  const first = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Original lease", exact: true }),
  });
  await expect(
    first.getByText("Renewal confirmation", { exact: true }),
  ).toBeVisible();
  await lease("Month-to-month continuation", "October 01, 2027");
  await expect(page.getByText("One active lease recorded")).toBeVisible();
  await page
    .getByRole("button", { name: "Edit lease Month-to-month continuation" })
    .click();
  await page.getByLabel("Lease starts (optional)").fill("October 01, 2026");
  await page.getByRole("button", { name: "Save lease", exact: true }).click();
  await expect(page.getByText(/Overlapping active leases/)).toBeVisible();
  await page
    .getByRole("button", { name: "Delete lease Original lease", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Original lease", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Renewal confirmation", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Overlapping active leases/)).toBeVisible();
  expect(
    await page.evaluate(() => document.body.scrollWidth <= innerWidth),
  ).toBe(true);
});
