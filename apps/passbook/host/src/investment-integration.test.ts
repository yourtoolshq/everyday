import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ChildProcess } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const hostRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const passbookRoot = join(hostRoot, "..");
const hostEntry = join(hostRoot, "src/index.ts");
const ytData = join(
  passbookRoot,
  "node_modules/@yourtoolshq/data/dist/yt-data.cjs",
);
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

async function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a port"));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function trpc<T>(
  baseUrl: string,
  path: string,
  input?: unknown,
  asQuery = false,
): Promise<T> {
  let response: Response;
  if (input !== undefined && !asQuery) {
    response = await fetch(`${baseUrl}/api/trpc/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: input }),
    });
  } else if (input !== undefined) {
    response = await fetch(
      `${baseUrl}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`,
    );
  } else {
    response = await fetch(`${baseUrl}/api/trpc/${path}`);
  }
  const body = (await response.json()) as {
    result?: { data: { json: T } };
    error?: { message: string };
  };
  if (!body.result) {
    throw new Error(`${path} failed: ${JSON.stringify(body)}`);
  }
  return body.result.data.json;
}

async function waitForHealth(baseUrl: string, child?: ChildProcess) {
  let stderr = "";
  child?.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });

  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = (await response.json()) as { status?: string };
      if (response.ok && body.status === "ok") return;
    } catch {
      // Host is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Host did not become ready at ${baseUrl}${stderr ? `\n${stderr}` : ""}`,
  );
}

function spawnHostProcess(env: Record<string, string>) {
  return spawn("node", ["--import", "tsx", hostEntry], {
    cwd: hostRoot,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function runYtData(
  args: string[],
  env: Record<string, string>,
): Promise<string> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(
      "node",
      [ytData, "--app", "passbook", "--migrations", "drizzle", ...args],
      {
        cwd: passbookRoot,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun(stdout);
        return;
      }
      reject(
        new Error(
          `yt-data ${args.join(" ")} failed (${code})\n${stdout}\n${stderr}`,
        ),
      );
    });
  });
}

async function stopHostProcess(child: ChildProcess) {
  if (child.killed) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function seedInvestmentStatement(baseUrl: string) {
  await trpc(baseUrl, "setup.initialize", {
    householdName: "Investment test household",
    people: ["Alex"],
  });

  const [person] = await trpc<{ id: string }[]>(baseUrl, "people.list");
  if (!person) throw new Error("Expected a household member");

  const institution = await trpc<{ id: string }>(
    baseUrl,
    "institutions.create",
    { name: "Fictional Brokerage" },
  );

  const account = await trpc<{ id: string }>(baseUrl, "accounts.create", {
    institutionId: institution.id,
    displayName: "Sample TFSA",
    accountType: "tfsa",
    openedDate: "2026-01-01",
    ownerIds: [person.id],
  });

  await trpc(baseUrl, "accounts.updateStatementSchedule", {
    accountId: account.id,
    frequency: "quarterly",
  });

  const form = new FormData();
  form.set(
    "file",
    new File([pdf], "q1-2026-statement.pdf", { type: "application/pdf" }),
  );
  const upload = await fetch(`${baseUrl}/api/data/upload/document`, {
    method: "POST",
    body: form,
  });
  expect(upload.status).toBe(201);
  const staged = (await upload.json()) as { token: string };

  const document = await trpc<{ id: string; fileId: string }>(
    baseUrl,
    "documents.create",
    {
      accountId: account.id,
      type: "statement",
      periodKey: "2026-Q1",
      documentDate: "2026-04-05",
      file: staged.token,
    },
  );

  const instrument = await trpc<{ id: string }>(
    baseUrl,
    "investmentInstruments.create",
    {
      displayName: "Fictional Equity ETF",
      kind: "etf",
      series: null,
      notes: null,
      identifiers: [{ kind: "ticker", value: "FETF", namespace: null }],
    },
  );

  const saved = await trpc<{ revision: number; reviewStatus: string }>(
    baseUrl,
    "investmentStatements.save",
    {
      documentId: document.id,
      expectedRevision: null,
      valuationDate: "2026-03-31",
      coverageStart: "2026-01-01",
      coverageEnd: "2026-03-31",
      summaryCoverage: "partial",
      holdingsCoverage: "partial",
      notes: "Fictional fixture",
      totals: [
        {
          currency: "CAD",
          scope: "account_total",
          closingValue: "12500.50",
          openingValue: "12000.00",
          cash: "250.00",
          bookCost: null,
          contributions: null,
          withdrawals: null,
          transfersIn: null,
          transfersOut: null,
          income: null,
          fees: null,
          reportedValueChange: null,
          sourcePage: 1,
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
          marketValue: "12250.50",
          quantity: "100",
          unitPrice: "122.505",
          unitPriceCurrency: "CAD",
          bookCost: null,
          bookCostCurrency: null,
          sourcePage: 2,
          sourceNote: null,
        },
        {
          instrumentId: null,
          lineKind: "cash",
          sourceLabel: "Cash balance",
          sourceIdentifier: null,
          sourceSeries: null,
          valueCurrency: "CAD",
          marketValue: "250.00",
          quantity: null,
          unitPrice: null,
          unitPriceCurrency: null,
          bookCost: null,
          bookCostCurrency: null,
          sourcePage: 2,
          sourceNote: null,
        },
      ],
    },
  );

  expect(saved.reviewStatus).toBe("draft");

  const reviewed = await trpc<{ reviewStatus: string; revision: number }>(
    baseUrl,
    "investmentStatements.review",
    { documentId: document.id, expectedRevision: saved.revision },
  );
  expect(reviewed.reviewStatus).toBe("reviewed");

  const holdings = await trpc<{
    instruments: { id: string; displayName: string }[];
    positions: { instrumentId: string }[];
  }>(baseUrl, "investmentInstruments.holdings");
  expect(holdings.instruments.some((row) => row.id === instrument.id)).toBe(
    true,
  );
  expect(
    holdings.positions.some((row) => row.instrumentId === instrument.id),
  ).toBe(true);

  return {
    accountId: account.id,
    documentId: document.id,
    fileId: document.fileId,
    instrumentId: instrument.id,
    revision: reviewed.revision,
  };
}

describe("passbook investment host integration", () => {
  let dataDir: string;
  let childHost: ChildProcess | undefined;
  let baseUrl: string;

  afterEach(async () => {
    if (childHost) await stopHostProcess(childHost);
    await rm(dataDir, { recursive: true, force: true });
  });

  it("persists enrichment, clears review on correction, and removes enrichment without deleting the file", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "passbook-investment-host-"));
    const port = String(await freePort());
    baseUrl = `http://127.0.0.1:${port}`;

    childHost = spawnHostProcess({
      DATA_DIR: dataDir,
      BACKUP_DIR: join(dataDir, "backups"),
      HOST: "127.0.0.1",
      PORT: port,
      NODE_ENV: "test",
    });
    await waitForHealth(baseUrl, childHost);

    const seeded = await seedInvestmentStatement(baseUrl);

    const corrected = await trpc<{ reviewStatus: string; revision: number }>(
      baseUrl,
      "investmentStatements.save",
      {
        documentId: seeded.documentId,
        expectedRevision: seeded.revision,
        valuationDate: "2026-03-31",
        coverageStart: "2026-01-01",
        coverageEnd: "2026-03-31",
        summaryCoverage: "partial",
        holdingsCoverage: "partial",
        notes: "Corrected fictional fixture",
        totals: [
          {
            currency: "CAD",
            scope: "account_total",
            closingValue: "12510.00",
            openingValue: "12000.00",
            cash: "250.00",
            bookCost: null,
            contributions: null,
            withdrawals: null,
            transfersIn: null,
            transfersOut: null,
            income: null,
            fees: null,
            reportedValueChange: null,
            sourcePage: 1,
            sourceNote: null,
          },
        ],
        positions: [
          {
            instrumentId: seeded.instrumentId,
            lineKind: "investment",
            sourceLabel: "Fictional Equity ETF",
            sourceIdentifier: "FETF",
            sourceSeries: null,
            valueCurrency: "CAD",
            marketValue: "12260.00",
            quantity: "100",
            unitPrice: "122.60",
            unitPriceCurrency: "CAD",
            bookCost: null,
            bookCostCurrency: null,
            sourcePage: 2,
            sourceNote: null,
          },
          {
            instrumentId: null,
            lineKind: "cash",
            sourceLabel: "Cash balance",
            sourceIdentifier: null,
            sourceSeries: null,
            valueCurrency: "CAD",
            marketValue: "250.00",
            quantity: null,
            unitPrice: null,
            unitPriceCurrency: null,
            bookCost: null,
            bookCostCurrency: null,
            sourcePage: 2,
            sourceNote: null,
          },
        ],
      },
    );
    expect(corrected.reviewStatus).toBe("draft");

    await stopHostProcess(childHost);
    childHost = undefined;
    await new Promise((resolve) => setTimeout(resolve, 500));

    childHost = spawnHostProcess({
      DATA_DIR: dataDir,
      BACKUP_DIR: join(dataDir, "backups"),
      HOST: "127.0.0.1",
      PORT: port,
      NODE_ENV: "test",
    });
    await waitForHealth(baseUrl, childHost);

    const afterRestart = await trpc<{
      snapshot: {
        reviewStatus: string;
        totals: { closingValue: string | null }[];
      };
    }>(
      baseUrl,
      "investmentStatements.getByDocument",
      { documentId: seeded.documentId },
      true,
    );
    expect(afterRestart.snapshot.reviewStatus).toBe("draft");
    expect(afterRestart.snapshot.totals[0]?.closingValue).toBe("12510");

    const list = await trpc<
      {
        documentId: string;
        comparisonEligible: boolean;
        graphEligible: boolean;
      }[]
    >(
      baseUrl,
      "investmentStatements.listByAccount",
      { accountId: seeded.accountId },
      true,
    );
    expect(list).toHaveLength(1);
    expect(list[0]?.graphEligible).toBe(true);
    expect(list[0]?.comparisonEligible).toBe(false);

    await trpc(baseUrl, "investmentStatements.remove", {
      documentId: seeded.documentId,
      expectedRevision: corrected.revision,
    });

    const removed = await trpc<{ snapshot: null }>(
      baseUrl,
      "investmentStatements.getByDocument",
      { documentId: seeded.documentId },
      true,
    );
    expect(removed.snapshot).toBeNull();

    const fileResponse = await fetch(
      `${baseUrl}/api/data/files/${seeded.fileId}`,
    );
    expect(fileResponse.status).toBe(200);
    expect(Buffer.from(await fileResponse.arrayBuffer())).toEqual(pdf);

    const statementStatus = await trpc<{
      missingStatements: { accountId: string; periodKey: string }[];
    }>(baseUrl, "overview.statementStatus");
    const stillComplete = statementStatus.missingStatements.some(
      (entry) =>
        entry.accountId === seeded.accountId && entry.periodKey === "2026-Q1",
    );
    expect(stillComplete).toBe(false);
  });

  it("accepts annual statement periods for save and review", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "passbook-investment-annual-"));
    const port = String(await freePort());
    baseUrl = `http://127.0.0.1:${port}`;

    childHost = spawnHostProcess({
      DATA_DIR: dataDir,
      BACKUP_DIR: join(dataDir, "backups"),
      HOST: "127.0.0.1",
      PORT: port,
      NODE_ENV: "test",
    });
    await waitForHealth(baseUrl, childHost);

    await trpc(baseUrl, "setup.initialize", {
      householdName: "Annual schedule household",
      people: ["Alex"],
    });
    const [person] = await trpc<{ id: string }[]>(baseUrl, "people.list");
    if (!person) throw new Error("Expected a household member");

    const institution = await trpc<{ id: string }>(
      baseUrl,
      "institutions.create",
      { name: "Fictional Annual Brokerage" },
    );
    const account = await trpc<{ id: string }>(baseUrl, "accounts.create", {
      institutionId: institution.id,
      displayName: "Annual RRSP",
      accountType: "rrsp",
      openedDate: "2024-01-01",
      ownerIds: [person.id],
    });
    await trpc(baseUrl, "accounts.updateStatementSchedule", {
      accountId: account.id,
      frequency: "annually",
    });

    const form = new FormData();
    form.set(
      "file",
      new File([pdf], "2026-annual-statement.pdf", { type: "application/pdf" }),
    );
    const upload = await fetch(`${baseUrl}/api/data/upload/document`, {
      method: "POST",
      body: form,
    });
    expect(upload.status).toBe(201);
    const staged = (await upload.json()) as { token: string };

    const document = await trpc<{ id: string }>(baseUrl, "documents.create", {
      accountId: account.id,
      type: "statement",
      periodKey: "2026",
      documentDate: "2027-01-15",
      file: staged.token,
    });

    const saved = await trpc<{ revision: number; reviewStatus: string }>(
      baseUrl,
      "investmentStatements.save",
      {
        documentId: document.id,
        expectedRevision: null,
        valuationDate: "2026-12-31",
        coverageStart: "2026-01-01",
        coverageEnd: "2026-12-31",
        summaryCoverage: "partial",
        holdingsCoverage: "not_entered",
        notes: null,
        totals: [
          {
            currency: "CAD",
            scope: "account_total",
            closingValue: "50000.00",
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
        positions: [],
      },
    );
    expect(saved.reviewStatus).toBe("draft");

    const reviewed = await trpc<{ reviewStatus: string }>(
      baseUrl,
      "investmentStatements.review",
      { documentId: document.id, expectedRevision: saved.revision },
    );
    expect(reviewed.reviewStatus).toBe("reviewed");

    const listed = await trpc<
      { documentId: string; periodKey: string; reviewStatus: string }[]
    >(
      baseUrl,
      "investmentStatements.listByAccount",
      { accountId: account.id },
      true,
    );
    expect(listed).toHaveLength(1);
    expect(listed[0]?.documentId).toBe(document.id);
    expect(listed[0]?.periodKey).toBe("2026");
    expect(listed[0]?.reviewStatus).toBe("reviewed");
  });

  it("survives verified backup and restore into a fresh data directory", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "passbook-investment-host-"));
    const restoreDataDir = await mkdtemp(
      join(tmpdir(), "passbook-investment-restore-"),
    );
    const backupDirPath = join(dataDir, "backups");
    const port = String(await freePort());
    baseUrl = `http://127.0.0.1:${port}`;

    childHost = spawnHostProcess({
      DATA_DIR: dataDir,
      BACKUP_DIR: backupDirPath,
      HOST: "127.0.0.1",
      PORT: port,
      NODE_ENV: "test",
    });
    await waitForHealth(baseUrl, childHost);

    const seeded = await seedInvestmentStatement(baseUrl);

    const backupOutput = await runYtData(["backup"], {
      DATA_DIR: dataDir,
      BACKUP_DIR: backupDirPath,
      PORT: port,
    });
    const backupMatch = /Created backup ([^:]+): verified/.exec(backupOutput);
    expect(backupMatch).not.toBeNull();
    const backupId = backupMatch?.[1];
    if (!backupId) throw new Error("Expected a verified backup identifier.");

    await runYtData(["verify", backupId], {
      DATA_DIR: dataDir,
      BACKUP_DIR: backupDirPath,
      PORT: port,
    });

    await stopHostProcess(childHost);
    childHost = undefined;
    await rm(restoreDataDir, { recursive: true, force: true });
    await mkdir(restoreDataDir, { recursive: true });

    await runYtData(["restore", backupId, "--direct"], {
      DATA_DIR: restoreDataDir,
      BACKUP_DIR: backupDirPath,
    });

    childHost = spawnHostProcess({
      DATA_DIR: restoreDataDir,
      BACKUP_DIR: backupDirPath,
      HOST: "127.0.0.1",
      PORT: port,
      NODE_ENV: "test",
    });
    await waitForHealth(baseUrl, childHost);

    const restored = await trpc<{
      snapshot: {
        reviewStatus: string;
        totals: { closingValue: string | null }[];
      };
    }>(
      baseUrl,
      "investmentStatements.getByDocument",
      { documentId: seeded.documentId },
      true,
    );
    expect(restored.snapshot.reviewStatus).toBe("reviewed");
    expect(restored.snapshot.totals[0]?.closingValue).toMatch(/^12500\.50?$/);

    const fileResponse = await fetch(
      `${baseUrl}/api/data/files/${seeded.fileId}`,
    );
    expect(fileResponse.status).toBe(200);
    expect(Buffer.from(await fileResponse.arrayBuffer())).toEqual(pdf);

    await rm(restoreDataDir, { recursive: true, force: true });
  });
});
