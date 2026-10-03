import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3847);
const host = process.env.HOST ?? "127.0.0.1";

type StubState = {
  initialized: boolean;
  householdName: string;
  people: Array<{ id: string; name: string }>;
  institutions: Array<{ id: string; name: string }>;
  accounts: Array<{
    id: string;
    institutionId: string;
    displayName: string;
    accountType: string;
    openedDate: string;
    ownerIds: string[];
  }>;
  documents: Array<{
    id: string;
    accountId: string;
    type: string;
    periodKey: string | null;
    title: string;
    fileId: string;
    mimeType: string;
  }>;
  files: Map<string, Uint8Array>;
};

const state: StubState = {
  initialized: false,
  householdName: "Test household",
  people: [],
  institutions: [],
  accounts: [],
  documents: [],
  files: new Map(),
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function trpcResult(data: unknown) {
  return json({ result: { data: { json: data } } });
}

function trpcError(message: string, code: number) {
  return json({ error: { message, code } }, code);
}

async function handleTrpc(path: string, request: Request) {
  const body =
    request.method === "POST"
      ? ((await request.json()) as { json?: unknown })
      : undefined;
  const input = body?.json;

  if (path === "setup.state") {
    return trpcResult({ initialized: state.initialized });
  }
  if (path === "setup.initialize") {
    if (state.initialized) {
      return trpcError("Passbook has already been set up.", 409);
    }
    const payload = input as { householdName: string; people: string[] };
    state.initialized = true;
    state.householdName = payload.householdName;
    state.people = payload.people.map((name) => ({
      id: randomUUID(),
      name,
    }));
    return trpcResult({ ok: true });
  }
  if (path === "people.list") {
    return trpcResult(state.people);
  }
  if (path === "institutions.create") {
    const payload = input as { name: string };
    const institution = { id: randomUUID(), name: payload.name };
    state.institutions.push(institution);
    return trpcResult(institution);
  }
  if (path === "institutions.list") {
    return trpcResult(state.institutions);
  }
  if (path === "accounts.create") {
    const payload = input as {
      institutionId: string;
      displayName: string;
      accountType: string;
      openedDate: string;
      ownerIds: string[];
    };
    const account = { id: randomUUID(), ...payload };
    state.accounts.push(account);
    return trpcResult(account);
  }
  if (path === "accounts.list") {
    return trpcResult(
      state.accounts.map((account) => ({
        ...account,
        institutionName:
          state.institutions.find((item) => item.id === account.institutionId)
            ?.name ?? "Institution",
        ownerIds: account.ownerIds,
      })),
    );
  }
  if (path === "overview.summary") {
    return trpcResult({
      householdName: state.householdName,
      memberCount: state.people.length,
      institutionCount: state.institutions.length,
      accountCount: state.accounts.length,
    });
  }
  if (path === "overview.statementStatus") {
    return trpcResult({
      yearSummary: {
        year: new Date().getFullYear(),
        expectedCount: 0,
        completeCount: state.documents.filter((doc) => doc.type === "statement")
          .length,
        notApplicableCount: 0,
        missingCount: 0,
        waitingCount: 0,
      },
      missingStatements: [],
    });
  }
  if (path === "documents.create") {
    const payload = input as {
      accountId: string;
      type: string;
      periodKey?: string;
      title?: string;
      file: string;
    };
    const fileId = randomUUID();
    const bytes = state.files.get(payload.file) ?? new Uint8Array();
    state.files.set(fileId, bytes);
    const document = {
      id: randomUUID(),
      accountId: payload.accountId,
      type: payload.type,
      periodKey: payload.periodKey ?? null,
      title: payload.title ?? "Document",
      fileId,
      mimeType: "application/pdf",
    };
    state.documents.push(document);
    return trpcResult(document);
  }
  if (path === "documents.overview") {
    return trpcResult(
      state.documents.map((document) => ({
        ...document,
        accountName:
          state.accounts.find((item) => item.id === document.accountId)
            ?.displayName ?? "Account",
        institutionName: "Northwind Bank",
      })),
    );
  }

  return trpcError(`Unknown procedure ${path}`, 404);
}

async function handleRequest(request: Request) {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/health") {
    return json({
      status: "ok",
      state: { state: "ready" },
      backup: {
        status: "idle",
        lastVerifiedBackupAt: null,
        sharesDataDir: false,
      },
    });
  }

  if (pathname === "/api/data/status") {
    return json({
      state: "ready",
      app: "passbook",
      version: "stub",
    });
  }

  if (pathname.startsWith("/api/trpc/")) {
    const path = pathname.replace("/api/trpc/", "");
    return handleTrpc(path, request);
  }

  if (
    pathname.startsWith("/api/data/upload/document") &&
    request.method === "POST"
  ) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ error: "Choose a non-empty file." }, 400);
    }
    const token = `document:${randomUUID()}`;
    state.files.set(token, new Uint8Array(await file.arrayBuffer()));
    return json(
      {
        token,
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/pdf",
      },
      201,
    );
  }

  const fileMatch = /^\/api\/data\/files\/([^/]+)$/.exec(pathname);
  const fileId = fileMatch?.[1];
  if (fileId && request.method === "GET") {
    const bytes = state.files.get(fileId);
    if (!bytes) return json({ error: "File not found" }, 404);
    return new Response(bytes, {
      headers: {
        "content-type": "application/pdf",
        "cache-control": "private, no-store",
      },
    });
  }

  return json({ error: "Not found" }, 404);
}

const server = createServer((req, res) => {
  void (async () => {
    const url = `http://${req.headers.host}${req.url}`;
    const chunks: Buffer[] = [];
    if (req.method !== "GET" && req.method !== "HEAD") {
      for await (const chunk of req) chunks.push(chunk as Buffer);
    }
    const request = new Request(url, {
      method: req.method,
      headers: req.headers as HeadersInit,
      body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
    });
    const response = await handleRequest(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  })();
});

server.listen(port, host, () => {
  console.info(`Passbook host stub listening on http://${host}:${port}`);
});
