import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test("sets up a household and tracks an item", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByRole("heading", { name: "Set up your Tax Book" })).toBeVisible();

  await page.getByLabel("Household label").fill("Example household");
  await page.getByLabel("Person 1 name").fill("Person A");
  await page.getByLabel("Person 2 name").fill("Person B");
  await page.getByLabel("Starting tax year").fill("2026");
  await page.getByRole("button", { name: "Open Tax Book" }).click();

  await expect(page.getByRole("heading", { name: "Example household" })).toBeVisible();
  await page.getByRole("link", { name: "Tax Items", exact: true }).click();
  await page.getByRole("button", { name: "Add tax item" }).first().click();
  await page.getByLabel("Name").fill("Example employment income");
  await page.getByLabel("Tax line/reference").fill("10100");
  await page.getByLabel("Expected amount").fill("50000");
  await page.getByLabel("Actual amount").fill("12500");
  await page.getByRole("button", { name: "Add tax item" }).last().click();

  await expect(page.getByText("Tax item created.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Example employment income", exact: true })).toBeVisible();
  await expect(page.getByText("10100", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Example employment income", exact: true }).click();
  await page.getByRole("button", { name: "Add Record" }).first().click();
  await page.getByLabel("Date").fill("2025-12-15");
  await page.getByLabel("Description").fill("Example supporting expense");
  await page.getByLabel("Amount counted").fill("300");
  await page.getByLabel("Attachment").setInputFiles({
    name: "fictional-receipt.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("fictional PDF content"),
  });
  await page.getByRole("button", { name: "Add Record" }).last().click();
  await expect(page.getByRole("heading", { name: "Use Records for the actual amount?" })).toBeVisible();
  await page.getByRole("button", { name: "Replace and add Record" }).click();
  await expect(page.getByText("Record added.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "$300.00" })).toBeVisible();
  const attachmentHref = await page.getByRole("link", { name: "fictional-receipt.pdf" }).getAttribute("href");
  const attachmentResponse = await page.request.get(attachmentHref!);
  expect(attachmentResponse.ok()).toBe(true);
  expect(attachmentResponse.headers()["content-type"]).toBe("application/pdf");
  expect(attachmentResponse.headers()["x-content-type-options"]).toBe("nosniff");
  expect(attachmentResponse.headers()["content-disposition"]).toContain("inline");
  expect(await attachmentResponse.text()).toBe("fictional PDF content");
  const downloadResponse = await page.request.get(`${attachmentHref}?download=1`);
  expect(downloadResponse.headers()["content-disposition"]).toContain("attachment");

  await page.getByRole("button", { name: "Example supporting expense", exact: true }).click();
  await page.getByLabel("Amount counted").fill("450");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Record updated.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "$450.00" })).toBeVisible();
  await page.getByRole("button", { name: "Actions for Example supporting expense" }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Delete Record" }).click();
  await expect(page.getByText("Record deleted.")).toBeVisible();

  await page.getByRole("button", { name: "Add Tax Document" }).first().click();
  await page.getByLabel("Issuer").fill("Employer A");
  await page.getByLabel("Attachment").setInputFiles({
    name: "fictional-t4.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("fictional T4 content"),
  });
  await page.getByRole("button", { name: "Add Tax Document" }).last().click();
  await expect(page.getByText("Tax Document added.")).toBeVisible();
  await expect(page.getByText("Received", { exact: true })).toBeVisible();
  const taxDocumentAttachmentHref = await page.getByRole("link", { name: "fictional-t4.pdf" }).getAttribute("href");
  const taxDocumentAttachmentResponse = await page.request.get(taxDocumentAttachmentHref!);
  expect(taxDocumentAttachmentResponse.ok()).toBe(true);
  expect(taxDocumentAttachmentResponse.headers()["content-type"]).toBe("application/pdf");
  expect(taxDocumentAttachmentResponse.headers()["x-content-type-options"]).toBe("nosniff");
  expect(taxDocumentAttachmentResponse.headers()["content-disposition"]).toContain("inline");
  expect(await taxDocumentAttachmentResponse.text()).toBe("fictional T4 content");
  const taxDocumentDownloadResponse = await page.request.get(`${taxDocumentAttachmentHref}?download=1`);
  expect(taxDocumentDownloadResponse.headers()["content-disposition"]).toContain("attachment");

  await page.getByRole("link", { name: "Tax Documents", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tax Documents" })).toBeVisible();
  await expect(page.getByText("1 need review")).toBeVisible();
  await page.getByLabel("Status for T4 from Employer A").click();
  await page.getByRole("option", { name: "Ready to file" }).click();
  await expect(page.getByText("All tracked documents are ready")).toBeVisible();

  await page.getByRole("link", { name: "Tax Items", exact: true }).click();
  await page.getByRole("link", { name: "Example employment income", exact: true }).click();

  await page.getByRole("button", { name: "Edit Tax Item" }).click();
  await page.getByLabel("Actual amount").fill("15000");
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "In progress" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Tax item updated.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Example employment income", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page.getByText("$15,000.00")).toBeVisible();
  await expect(page.getByText("Expected $50,000.00 · 1 item")).toBeVisible();
  await expect(page.getByText("All tracked documents are ready")).toBeVisible();

  await page.getByRole("button", { name: "Tax year" }).click();
  await page.getByRole("menuitem", { name: "New tax year" }).click();
  await page.getByLabel("Calendar year").fill("2027");
  const createdYearReload = page.waitForEvent("load");
  await page.getByRole("button", { name: "Create year" }).click();
  await createdYearReload;
  await expect(page.getByText("2027 tax year")).toBeVisible();
  await expect(page.getByText("0 total items for 2027")).toBeVisible();
  await expect(page.getByText("No tax documents tracked")).toBeVisible();
  await page.getByRole("link", { name: "Tax Estimate", exact: true }).click();
  await expect(page.getByText("Estimate unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText("Tax Estimate currently supports the 2026 tax year only.")).toBeVisible();

  await page.getByRole("button", { name: "Tax year" }).click();
  const selectedYearReload = page.waitForEvent("load");
  await page.getByRole("menuitem", { name: "2026" }).click();
  await selectedYearReload;
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByText("2026 tax year")).toBeVisible();
  await expect(page.getByText("$15,000.00")).toBeVisible();
  await expect(page.getByText("All tracked documents are ready")).toBeVisible();

  await page.getByRole("link", { name: "Tax Items", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Actions for Example employment income" }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Delete this tax item?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("link", { name: "Example employment income", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Actions for Example employment income" }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Delete item" }).click();
  await expect(page.getByText("Tax item deleted.")).toBeVisible();
  await expect(page.getByText("No tax items yet")).toBeVisible();

  await page.getByRole("link", { name: "Paycheques", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Paycheques", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Add employment" }).click();
  await page.getByLabel("Employer label").fill("Employer A");
  await page.getByLabel("CPP2", { exact: true }).uncheck();
  await page.getByLabel("WI", { exact: true }).check();
  await page.getByLabel("LTD", { exact: true }).check();
  await page.getByRole("button", { name: "Add employment" }).last().click();
  await expect(page.getByText("Employment added.")).toBeVisible();

  await page.getByRole("button", { name: "Add paycheque" }).first().click();
  await page.getByLabel("Pay date").fill("2026-06-19");
  await page.getByLabel("Gross pay").fill("2000");
  await page.getByLabel("Income tax withheld").fill("350");
  await page.getByLabel("CPP", { exact: true }).fill("110");
  await expect(page.getByLabel("CPP2", { exact: true })).toHaveCount(0);
  await page.getByLabel("EI", { exact: true }).fill("32");
  await page.getByLabel("WI", { exact: true }).fill("10");
  await page.getByLabel("LTD", { exact: true }).fill("20");
  await page.getByLabel("Other deductions").fill("48");
  await expect(page.getByLabel("Net pay (calculated)")).toHaveValue("1430.00");
  await page.getByRole("button", { name: "Add paycheque" }).last().click();
  await expect(page.getByText("Paycheque added.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "$2,000.00" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "$570.00" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "$1,430.00" })).toBeVisible();
  await page.getByLabel("Filter by person").click();
  await page.getByRole("option", { name: "Person B" }).click();
  await expect(page.getByText("No paycheques match these filters")).toBeVisible();
  await page.getByLabel("Filter by person").click();
  await page.getByRole("option", { name: "Person A" }).click();
  await expect(page.getByRole("cell", { name: "$2,000.00" })).toBeVisible();

  await page.getByRole("button", { name: /Jun 19, 2026/ }).click();
  await page.getByLabel("Gross pay").fill("2100");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Paycheque updated.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "$2,100.00" })).toBeVisible();
  await page.getByRole("link", { name: "Tax Items" }).click();
  await expect(page.getByRole("link", { name: "Employment income — Employer A", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "$2,100.00" })).toBeVisible();

  await page.getByRole("link", { name: "Tax Estimate", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tax Estimate", exact: true })).toBeVisible();
  await expect(page.getByText("Projected household result")).toBeVisible();
  await expect(page.getByText("2026 Manitoba planning estimate—not filing software.")).toBeVisible();
  await page.getByLabel("Person A RRSP contribution").fill("1000");
  await page.getByLabel("Person A RRSP deduction").fill("1000");
  await page.getByRole("button", { name: "Calculate scenario" }).click();
  await expect(page.getByText("Household tax savings")).toBeVisible();
  await page.getByLabel("Person A full-time months").fill("1");
  await page.getByRole("button", { name: "Save estimate settings" }).click();
  await expect(page.getByText("Estimate settings updated.")).toBeVisible();

  await page.getByRole("link", { name: "Paycheques", exact: true }).click();
  await page.getByLabel("Filter by employer").click();
  await page.getByRole("option", { name: "Person A — Employer A" }).click();
  await page.getByRole("button", { name: "Edit employment" }).click();
  await page.getByRole("button", { name: "Delete employment" }).click();
  await page.getByRole("button", { name: "Delete employment" }).last().click();
  await expect(page.getByText("Employment and its paycheques deleted.")).toBeVisible();
  await expect(page.getByText("No paycheques yet")).toBeVisible();
});
