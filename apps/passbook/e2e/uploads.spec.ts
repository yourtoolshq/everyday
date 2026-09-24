import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "@playwright/test";

const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const eml = Buffer.from(
  [
    "From: Northwind Bank <notices@example.com>",
    "To: alex@example.com",
    "Subject: Fee schedule update",
    "Date: Tue, 1 Sep 2026 09:00:00 +0000",
    "Content-Type: text/plain",
    "",
    "Your fee schedule changes on October 1.",
    "",
  ].join("\r\n"),
);

async function trpc<T>(
  request: APIRequestContext,
  path: string,
  input?: unknown,
): Promise<T> {
  const response =
    input === undefined
      ? await request.get(`/api/trpc/${path}`)
      : await request.post(`/api/trpc/${path}`, { data: { json: input } });
  const body = (await response.json()) as { result?: { data: { json: T } } };
  if (!body.result) throw new Error(`${path} failed: ${JSON.stringify(body)}`);
  return body.result.data.json;
}

async function createAccount(request: APIRequestContext) {
  const state = await trpc<{ initialized: boolean }>(request, "setup.state");
  if (!state.initialized) {
    await trpc(request, "setup.initialize", {
      householdName: "Test household",
      people: ["Alex"],
    });
  }
  const [person] = await trpc<{ id: string }[]>(request, "people.list");
  const institution = await trpc<{ id: string }>(
    request,
    "institutions.create",
    { name: "Northwind Bank" },
  );
  const account = await trpc<{ id: string }>(request, "accounts.create", {
    institutionId: institution.id,
    displayName: "Everyday Chequing",
    accountType: "chequing",
    openedDate: "2026-01-15",
    ownerIds: [person!.id],
  });
  return account.id;
}

test("account documents upload, open, preview, and delete", async ({
  page,
  request,
}) => {
  test.setTimeout(process.env.CI ? 90_000 : 60_000);

  const accountId = await createAccount(request);
  await page.goto(`/accounts/${accountId}`);

  const addDocument = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Documents", { exact: true }) })
    .getByRole("button", { name: "Add" });
  const sheet = page.getByRole("dialog", { name: "Upload document" });

  await addDocument.click();
  await sheet.getByLabel("File").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("plain text"),
  });
  await sheet.getByRole("button", { name: "Save document" }).click();
  await expect(
    page.getByText(
      /^Upload a PDF, an image, an .eml file, or a common audio file/,
    ),
  ).toBeVisible();

  await sheet.getByLabel("File").setInputFiles({
    name: "welcome-letter.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await sheet.getByRole("button", { name: "Save document" }).click();
  await expect(page.getByText("Document uploaded.")).toBeVisible();
  await expect(sheet).toBeHidden();

  const openLink = page.getByRole("link", { name: "Open welcome-letter" });
  const href = await openLink.getAttribute("href");
  expect(href).toMatch(/^\/api\/data\/files\/[0-9a-f-]{36}$/);
  const served = await request.get(href!);
  expect(served.headers()["content-type"]).toBe("application/pdf");
  expect(await served.body()).toEqual(pdf);

  await addDocument.click();
  await sheet.getByLabel("File").setInputFiles({
    name: "fee-update.eml",
    mimeType: "message/rfc822",
    buffer: eml,
  });
  await sheet.getByRole("button", { name: "Save document" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("button", { name: "Preview fee-update" }).click();
  const preview = page.getByRole("dialog", { name: "Fee schedule update" });
  await expect(
    preview.getByText("Your fee schedule changes on October 1."),
  ).toBeVisible();
  await expect(
    preview.getByRole("link", { name: "Open original" }),
  ).toHaveAttribute("href", /^\/api\/data\/files\/[0-9a-f-]{36}$/);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Delete welcome-letter" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText("Document removed.")).toBeVisible();
  await expect(openLink).toBeHidden();
  expect((await request.get(href!)).status()).toBe(404);
});

test("statement upload stores the file", async ({ page, request }) => {
  test.setTimeout(process.env.CI ? 90_000 : 60_000);

  const accountId = await createAccount(request);
  await page.goto(`/accounts/${accountId}`);

  await page.getByRole("button", { name: "Upload statement" }).click();
  const sheet = page.getByRole("dialog", { name: "Upload statement" });
  await sheet.getByLabel("File").setInputFiles({
    name: "statement.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await sheet.getByRole("button", { name: "Save statement" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("button", { name: /^View .* statement$/ }).click();
  const href = await page
    .getByRole("dialog")
    .getByRole("link", { name: "Open" })
    .getAttribute("href");
  const served = await request.get(href!);
  expect(served.status()).toBe(200);
  expect(await served.body()).toEqual(pdf);
});
