import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

type SnapshotDto = {
  documentId: string;
  revision: number;
  reviewStatus: "draft" | "reviewed";
  valuationDate: string;
  documentTitle: string;
  totals: { closingValue: string | null; currency: string; scope: string }[];
  holdingsCoverage: string;
  summaryCoverage: string;
};

async function trpc<T>(
  request: APIRequestContext,
  path: string,
  input?: unknown,
): Promise<T> {
  let response;
  if (input === undefined) {
    response = await request.get(`/api/trpc/${path}`);
  } else {
    response = await request.post(`/api/trpc/${path}`, {
      data: { json: input },
    });
  }
  const body = (await response.json()) as { result?: { data: { json: T } } };
  if (!body.result) throw new Error(`${path} failed: ${JSON.stringify(body)}`);
  return body.result.data.json;
}

async function trpcQuery<T>(
  request: APIRequestContext,
  path: string,
  input: unknown,
): Promise<T> {
  const response = await request.get(
    `/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`,
  );
  const body = (await response.json()) as { result?: { data: { json: T } } };
  if (!body.result) throw new Error(`${path} failed: ${JSON.stringify(body)}`);
  return body.result.data.json;
}

async function uploadStatementPdf(
  request: APIRequestContext,
  accountId: string,
  periodKey: string,
  filename: string,
) {
  const form = await request.post("/api/data/upload/document", {
    multipart: {
      file: {
        name: filename,
        mimeType: "application/pdf",
        buffer: pdf,
      },
    },
  });
  expect(form.status()).toBe(201);
  const staged = (await form.json()) as { token: string };
  return trpc<{ id: string; fileId: string; title: string }>(
    request,
    "documents.create",
    {
      accountId,
      type: "statement",
      periodKey,
      documentDate: "2026-04-10",
      file: staged.token,
    },
  );
}

async function createInvestmentFixture(request: APIRequestContext) {
  const state = await trpc<{ initialized: boolean }>(request, "setup.state");
  if (!state.initialized) {
    await trpc(request, "setup.initialize", {
      householdName: "Investment E2E household",
      people: ["Alex"],
    });
  }

  const [person] = await trpc<{ id: string }[]>(request, "people.list");
  if (!person) throw new Error("Expected household member");

  const institution = await trpc<{ id: string }>(
    request,
    "institutions.create",
    { name: "Fictional Brokerage" },
  );

  const account = await trpc<{ id: string }>(request, "accounts.create", {
    institutionId: institution.id,
    displayName: "E2E TFSA",
    accountType: "tfsa",
    openedDate: "2026-01-01",
    ownerIds: [person.id],
  });

  await trpc(request, "accounts.updateStatementSchedule", {
    accountId: account.id,
    frequency: "quarterly",
  });

  const document = await uploadStatementPdf(
    request,
    account.id,
    "2026-Q1",
    "fictional-q1-2026.pdf",
  );

  return {
    accountId: account.id,
    documentId: document.id,
    fileId: document.fileId,
  };
}

async function openInvestmentWorkspace(page: Page, documentId: string) {
  await page.goto(`/statements/${documentId}/investments`);
  await expect(page).toHaveURL(
    new RegExp(`/statements/${documentId}/investments`),
  );
  await expect(
    page.getByText("Statement not found or not eligible."),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible({
    timeout: 15_000,
  });
}

async function selectCoverage(
  page: Page,
  triggerId: string,
  label: "Partial" | "Complete" | "Not entered",
) {
  await page.locator(`#${triggerId}`).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

async function fillManualStatementWorkspace(page: Page) {
  await page.getByLabel("Valuation date").fill("2026-03-31");
  await page.getByLabel("Coverage start").fill("2026-01-01");
  await page.getByLabel("Coverage end").fill("2026-03-31");

  await selectCoverage(page, "summary-coverage", "Partial");
  await page.getByLabel("Closing value", { exact: true }).fill("12500.50");
  await page.getByLabel("Summary cash", { exact: true }).fill("250.00");

  await selectCoverage(page, "holdings-coverage", "Partial");
  await page.getByRole("button", { name: "Add line" }).click();

  await page.getByLabel("Source label").first().fill("Fictional Equity ETF");
  await page.getByRole("button", { name: "Link instrument" }).click();
  await page.getByRole("button", { name: "New instrument" }).click();
  await page.locator("#instrument-name").fill("Fictional Equity ETF");
  await page.getByPlaceholder("Value").first().fill("FETF");
  await page.getByRole("button", { name: "Save instrument" }).click();
  await expect(page.getByText("Instrument added to catalog.")).toBeVisible();

  await page
    .getByLabel("Market value", { exact: true })
    .first()
    .fill("12250.50");
  await page.getByLabel("Quantity", { exact: true }).first().fill("100");

  await page.getByRole("button", { name: "Add line" }).click();
  const cashLineCard = page
    .locator(".rounded-xl.border")
    .filter({ hasText: "Line 2" });
  await cashLineCard.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Cash", exact: true }).click();
  await cashLineCard.getByLabel("Source label").fill("Cash balance");
  await cashLineCard.getByLabel("Market value", { exact: true }).fill("250.00");
}

test.describe("investment statement enrichment", () => {
  test("manual entry, instrument catalog, draft/review lifecycle, persistence, comparison, and removal", async ({
    page,
    request,
  }) => {
    test.setTimeout(process.env.CI ? 180_000 : 120_000);

    const fixture = await createInvestmentFixture(request);
    await trpcQuery(request, "investmentInstruments.list", {});
    await openInvestmentWorkspace(page, fixture.documentId);

    await fillManualStatementWorkspace(page);

    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.")).toBeVisible();
    await expect(page.getByText("Draft details")).toBeVisible();

    await page.getByRole("button", { name: "Review" }).click();
    await expect(page.getByText("Facts marked as reviewed.")).toBeVisible();
    await expect(page.getByText("Reviewed · partial")).toBeVisible();

    await page.getByLabel("Closing value", { exact: true }).fill("12510.00");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft details")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Closing value", { exact: true })).toHaveValue(
      /12510(\.00)?/,
    );
    await page.getByRole("button", { name: "Review" }).click();
    await expect(page.getByText("Facts marked as reviewed.")).toBeVisible();

    await page.goto("/holdings");
    await expect(
      page.getByRole("heading", { name: "Holdings", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Fictional Equity ETF")).toBeVisible();
    await expect(page.getByText("E2E TFSA").first()).toBeVisible();

    const secondDocument = await uploadStatementPdf(
      request,
      fixture.accountId,
      "2026-Q2",
      "fictional-q2-2026.pdf",
    );

    const instrument = (
      await trpcQuery<{ id: string }[]>(
        request,
        "investmentInstruments.list",
        {},
      )
    )[0];
    if (!instrument) throw new Error("Expected catalog instrument");

    await trpc(request, "investmentStatements.save", {
      documentId: secondDocument.id,
      expectedRevision: null,
      valuationDate: "2026-06-30",
      coverageStart: "2026-04-01",
      coverageEnd: "2026-06-30",
      summaryCoverage: "partial",
      holdingsCoverage: "partial",
      notes: null,
      totals: [
        {
          currency: "CAD",
          scope: "account_total",
          closingValue: "13000.00",
          openingValue: null,
          cash: null,
          bookCost: null,
          contributions: null,
          withdrawals: null,
          transfersIn: null,
          transfersOut: null,
          income: null,
          fees: null,
          reportedValueChange: null,
          sourcePage: null,
          sourceNote: null,
        },
      ],
      positions: [
        {
          instrumentId: instrument.id,
          lineKind: "investment",
          sourceLabel: "Fictional Equity ETF",
          sourceIdentifier: "FETF",
          sourceSeries: null,
          valueCurrency: "CAD",
          marketValue: "13000.00",
          quantity: "110",
          unitPrice: null,
          unitPriceCurrency: null,
          bookCost: null,
          bookCostCurrency: null,
          sourcePage: null,
          sourceNote: null,
        },
      ],
    });
    const secondDraft = await trpcQuery<{ snapshot: SnapshotDto | null }>(
      request,
      "investmentStatements.getByDocument",
      { documentId: secondDocument.id },
    );
    if (!secondDraft.snapshot) {
      throw new Error("Expected saved snapshot for second statement.");
    }
    await trpc(request, "investmentStatements.review", {
      documentId: secondDocument.id,
      expectedRevision: secondDraft.snapshot.revision,
    });

    await page.goto(`/accounts/${fixture.accountId}`);
    await expect(page.getByText("Investment statement history")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "What changed?" }),
    ).toBeVisible();

    await page.getByLabel("Earlier observation").click();
    await page
      .getByRole("option", { name: /Mar 31, 2026/ })
      .first()
      .click();
    await page.getByLabel("Later observation").click();
    await page
      .getByRole("option", { name: /Jun 30, 2026/ })
      .first()
      .click();

    await expect(
      page.getByText(/This is not investment return\./),
    ).toBeVisible();
    await expect(
      page.getByText(/reported quantity increased between statements/),
    ).toBeVisible();
    await expect(
      page.getByText(/not reported on the later statement/),
    ).toHaveCount(0);

    const statementStatus = await trpcQuery<{
      missingStatements: { periodKey: string }[];
    }>(request, "overview.statementStatus", {});
    expect(
      statementStatus.missingStatements.some(
        (row) => row.periodKey === "2026-Q1",
      ),
    ).toBe(false);

    await page.goto(`/statements/${fixture.documentId}/investments`);
    await page.getByRole("button", { name: "Remove details" }).click();
    await page
      .getByRole("alertdialog", { name: "Remove investment details?" })
      .getByRole("button", { name: "Remove details" })
      .click();
    await expect(
      page.getByText(
        "Investment details removed. The statement file is unchanged.",
      ),
    ).toBeVisible();
    await expect(page.getByText("No details")).toBeVisible();

    const sourceLink = page.getByRole("link", { name: "Open source file" });
    const href = await sourceLink.getAttribute("href");
    expect(href).toMatch(/^\/api\/data\/files\/[0-9a-f-]{36}$/);
    const served = await request.get(href!);
    expect(served.status()).toBe(200);
    expect(await served.body()).toEqual(pdf);
  });

  test("partial holdings avoid sold-holding claims in comparisons", async ({
    page,
    request,
  }) => {
    test.setTimeout(process.env.CI ? 120_000 : 90_000);

    const fixture = await createInvestmentFixture(request);
    await trpcQuery(request, "investmentInstruments.list", {});
    const instrument = await trpc<{ id: string }>(
      request,
      "investmentInstruments.create",
      {
        displayName: "Fictional Balanced Fund",
        kind: "mutual_fund",
        series: "A",
        notes: null,
        identifiers: [{ kind: "fund_code", value: "FBAL-A", namespace: null }],
      },
    );

    const completeDoc = { id: fixture.documentId };
    const partialDoc = await uploadStatementPdf(
      request,
      fixture.accountId,
      "2026-Q2",
      "fictional-q2-partial.pdf",
    );

    async function saveReviewed(
      documentId: string,
      valuationDate: string,
      holdingsCoverage: "complete" | "partial",
      quantity: string,
    ) {
      const saved = await trpc<{ revision: number }>(
        request,
        "investmentStatements.save",
        {
          documentId,
          expectedRevision: null,
          valuationDate,
          coverageStart: null,
          coverageEnd: null,
          summaryCoverage: "partial",
          holdingsCoverage,
          notes: null,
          totals: [
            {
              currency: "CAD",
              scope: "account_total",
              closingValue: "10000.00",
              openingValue: null,
              cash: null,
              bookCost: null,
              contributions: null,
              withdrawals: null,
              transfersIn: null,
              transfersOut: null,
              income: null,
              fees: null,
              reportedValueChange: null,
              sourcePage: null,
              sourceNote: null,
            },
          ],
          positions: [
            {
              instrumentId: instrument.id,
              lineKind: "investment",
              sourceLabel: "Fictional Balanced Fund",
              sourceIdentifier: "FBAL-A",
              sourceSeries: "A",
              valueCurrency: "CAD",
              marketValue: "10000.00",
              quantity,
              unitPrice: null,
              unitPriceCurrency: null,
              bookCost: null,
              bookCostCurrency: null,
              sourcePage: null,
              sourceNote: null,
            },
          ],
        },
      );
      await trpc(request, "investmentStatements.review", {
        documentId,
        expectedRevision: saved.revision,
      });
    }

    await saveReviewed(completeDoc.id, "2026-03-31", "complete", "50");
    await saveReviewed(partialDoc.id, "2026-06-30", "partial", "55");

    await page.goto(`/accounts/${fixture.accountId}`);
    await expect(page.getByText("Investment statement history")).toBeVisible();
    await page.getByLabel("Earlier observation").click();
    await page
      .getByRole("option", { name: /Mar 31, 2026/ })
      .first()
      .click();
    await page.getByLabel("Later observation").click();
    await page
      .getByRole("option", { name: /Jun 30, 2026/ })
      .first()
      .click();

    await expect(
      page.getByText(
        /Holdings comparisons are limited until both snapshots have complete holdings coverage/,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/not reported on the later statement/),
    ).toHaveCount(0);
  });
});
