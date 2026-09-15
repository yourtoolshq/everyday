import { expect, test } from "@playwright/test";

test("renders the private application shell", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "First Aid is ready" }),
  ).toBeVisible();
  await expect(page.getByTestId("system-status")).toHaveText(
    "Local system ready",
  );

  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();

  if (testInfo.project.name === "mobile-chromium") {
    await expect(page.getByRole("dialog")).toBeVisible();
  }

  await expect(page.getByText("First Aid", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Care Plan" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Visits" })).toBeDisabled();
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
