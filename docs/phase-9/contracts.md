# Phase 9 — Host, client, and desktop contracts

Shared expectations for the Passbook foundation wave. Host, client, and desktop
implementations must conform to these contracts; follow-on assignments must not
invent incompatible configuration, lifecycle, or error behavior.

Normative details for the proof workflow live in
[baseline.md](./baseline.md). This document defines cross-cutting contracts with
representative examples.

## App identity and data isolation

| Field                        | Value                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Application id               | `passbook`                                                                                                        |
| Display name                 | Passbook                                                                                                          |
| Data platform app key        | `"passbook"` in `defineDataPlatform`                                                                              |
| Default data directory (dev) | `./.data` relative to host working directory                                                                      |
| Production-style paths       | `DATA_DIR=/data`, `BACKUP_DIR=/backups` (unchanged from Phase 4/7)                                                |
| Desktop data directory       | `~/Library/Application Support/Passbook/data/` through Electron `userData` on supported macOS arm64 installations |

Passbook data must never read or write Taxbook, First Aid, or Tenure paths.
Multiple Passbook hosts on one machine must use distinct `DATA_DIR` values.

### Configuration sources (precedence)

1. Environment variables (host process)
2. Desktop shell injected env when it spawns the host
3. Optional future user config file (`Later`)

| Variable               | Required             | Default                                                            | Consumer           |
| ---------------------- | -------------------- | ------------------------------------------------------------------ | ------------------ |
| `DATA_DIR`             | no                   | `./.data`                                                          | Host               |
| `BACKUP_DIR`           | no                   | `<DATA_DIR>/backups`                                               | Host               |
| `APP_VERSION`          | no                   | unset                                                              | Host / health      |
| `PORT`                 | no                   | `3847` (proposed foundation port; avoids 3002 Next dev collision)  | Host               |
| `HOST`                 | no                   | `127.0.0.1`                                                        | Host bind address  |
| `PASSBOOK_HOST_URL`    | yes (client/desktop) | `http://127.0.0.1:3847`                                            | Client             |
| `PASSBOOK_CLIENT_DIST` | packaged host only   | unset in development; bundled client resource in a desktop install | Host static client |
| `NODE_ENV`             | no                   | `development`                                                      | All                |

The foundation port `3847` is a proposed default to keep the new host parallel
to the existing Next dev server on `3002`. Integration owner registers the
final value in workspace scripts.

### Host discovery

The client and desktop resolve:

- tRPC: `${PASSBOOK_HOST_URL}/api/trpc`
- Data HTTP: `${PASSBOOK_HOST_URL}/api/data/...`
- Health: `${PASSBOOK_HOST_URL}/api/health`
- File download: `${PASSBOOK_HOST_URL}/api/data/files/:id`

No service discovery in the foundation wave. In development, the client uses
`PASSBOOK_HOST_URL` through the Vite proxy. In a packaged desktop app, Electron
starts the host with `PASSBOOK_CLIENT_DIST` and loads the SPA from the host root,
so the client and API share one loopback origin.

## Platform lifecycle and readiness

The host owns `dataPlatform.boot()` and reports state through existing platform
APIs.

### States

| State       | Meaning                           | Host accepts writes | Client behavior                      |
| ----------- | --------------------------------- | ------------------- | ------------------------------------ |
| `ready`     | Migrations complete; DB reachable | yes                 | Normal UI                            |
| `upgrading` | Backup/migrate in progress        | no                  | Full-screen maintenance message      |
| `restoring` | Restore in progress               | no                  | Full-screen maintenance message      |
| `blocked`   | Operator action required          | no                  | Blocked screen with platform message |

Source of truth: `await dataPlatform.state()` and
`await dataPlatform.status()` in `packages/data/src/platform.ts`.

### Host startup sequence

```text
process start
  → load env / config
  → dataPlatform.boot()
  → bind HTTP listener
  → log { app, version, port, dataDir, state }
```

On boot failure (for example missing permissions on `DATA_DIR`), the host process
exits non-zero after logging a single actionable message. The desktop shell
surfaces that message.

### Host shutdown

```text
SIGTERM / SIGINT
  → stop accepting new HTTP connections
  → wait for in-flight requests (bounded timeout, e.g. 10s)
  → close data platform / DB
  → exit 0
```

Abrupt kill may leave SQLite WAL files; Phase 4 recovery procedures apply.

### Health endpoint

`GET /api/health` behavior matches `apps/passbook/src/server/health.ts`:

**Maintenance (platform not ready):**

```json
HTTP 200
{ "status": "maintenance", "state": { "state": "upgrading", "step": "migrate", "migrations": ["0003_add_documents"] } }
```

**Ready:**

```json
HTTP 200
{
  "status": "ok",
  "state": { "state": "ready" },
  "backup": {
    "status": "idle",
    "lastVerifiedBackupAt": "2026-09-15T02:00:00.000Z",
    "sharesDataDir": false
  }
}
```

**Database unreachable while platform ready:**

```json
HTTP 503
{ "status": "error", "state": { "state": "ready" } }
```

### Data status endpoint

`GET /api/data/status` returns `PlatformStatus` JSON (same as today via
`createDataHandlers`). Clients use this for maintenance/blocked screens when tRPC
is unavailable.

Example blocked response:

```json
HTTP 200
{
  "state": "blocked",
  "reason": "migration_failed",
  "message": "Passbook stopped before applying a data change. Restore a backup from Settings.",
  "app": "passbook",
  "version": "0.1.0",
  "restorableBackups": [{ "id": "20260915-020001", "createdAt": "...", "appVersion": "0.1.0", "trigger": "scheduled" }]
}
```

## tRPC and domain errors

### Transport

- Protocol: tRPC v11 over HTTP POST/GET at `/api/trpc`
- Transformer: SuperJSON
- Base procedure: all public procedures use `requireReady(dataPlatform)`

### Readiness errors

When the platform is not ready, mutations and queries through tRPC return:

```json
HTTP 503 (tRPC SERVICE_UNAVAILABLE)
{ "message": "Passbook is upgrading its data; try again when it is done" }
```

Messages come from `describeUnavailable` in `packages/data/src/readiness.ts`.

### Domain errors (representative)

| Condition                | tRPC code     | Example message                     |
| ------------------------ | ------------- | ----------------------------------- |
| Validation               | `BAD_REQUEST` | Zod field errors in `data.zodError` |
| Duplicate setup          | `CONFLICT`    | `Passbook has already been set up.` |
| Missing record           | `NOT_FOUND`   | Entity-specific message from router |
| Invalid statement period | `BAD_REQUEST` | From `validateStatementPeriod`      |

Clients map these to toasts or inline form errors using existing component
patterns. Do not expose stack traces or SQL details.

### File upload errors

`POST /api/data/upload/:endpoint` returns plain HTTP errors:

| Case               | Status | Body                                           |
| ------------------ | ------ | ---------------------------------------------- |
| Platform not ready | 503    | `{ "error": "<describeUnavailable message>" }` |
| Wrong type         | 400    | `{ "error": "…" }`                             |
| Too large          | 413    | `{ "error": "…" }`                             |

Successful staging response:

```json
HTTP 200
{ "token": "staging-abc123", "name": "statement.pdf", "size": 1024 }
```

## First workflow operations

The foundation gate must implement at least these procedures and routes.

### tRPC procedures

| Router         | Procedure                      | Purpose                          |
| -------------- | ------------------------------ | -------------------------------- |
| `setup`        | `state`, `initialize`          | First-run household              |
| `people`       | `list`                         | Owner picker                     |
| `institutions` | `create`, `list`               | Institution inventory            |
| `accounts`     | `create`, `list`, `get`        | Account + schedule               |
| `documents`    | `create`, `overview`, `delete` | Statement and account documents  |
| `overview`     | `summary`, `statementStatus`   | Dashboard and missing statements |

Exact input/output shapes remain those exported by
`apps/passbook/src/server/api/root.ts`. Clients must not depend on undocumented
fields.

### HTTP routes

| Method   | Path                        | Purpose                           |
| -------- | --------------------------- | --------------------------------- |
| GET/POST | `/api/trpc/*`               | Application operations            |
| POST     | `/api/data/upload/document` | Stage file before tRPC claim      |
| GET      | `/api/data/files/:id`       | Serve or download document        |
| GET      | `/api/data/status`          | Platform status                   |
| GET      | `/api/health`               | Liveness/readiness for supervisor |

## Local access boundary

Foundation wave scope:

- Host binds to loopback only (`127.0.0.1`).
- No TLS, no bearer tokens, no account system.
- Client refuses to connect to non-loopback URLs unless an explicit
  `PASSBOOK_ALLOW_REMOTE=1` dev flag is set (default off).

Future authenticated remote access (ADR-0002) adds pairing, host identity, and
revocation **Later**. It must not expose today's unauthenticated tRPC and file
routes on a public interface.

## Client connection behavior

```text
App load
  → read PASSBOOK_HOST_URL
  → GET /api/health
      → maintenance/blocked → show gate screen (reuse DataGate copy where possible)
      → error / network fail → connection error screen with retry
      → ok → setup.state
          → initialized false → /setup
          → initialized true → app shell
```

Connection errors show:

- host URL attempted;
- whether the host process appears down vs. returning an error;
- a Retry action that re-runs health check.

Domain errors during normal operation stay in-context (toast/form); they do not
replace the entire shell.

## Desktop shell behavior

### Startup

```text
Electron main
  → spawn host with PASSBOOK_HOST_URL=http://127.0.0.1:<port>
  → poll GET /api/health until ok or maintenance-with-listener, or timeout (30s)
  → on failure: show error window with host stderr tail / exit code
  → on success: open BrowserWindow → client URL
```

### Window close

Closing the desktop window **does not** stop the host process. The user can
reopen the app and reconnect to the same host/data. Document this in desktop
onboarding copy.

Quitting the desktop application entirely (explicit Quit) sends SIGTERM to the
host after the last window closes, unless a `PASSBOOK_LEAVE_HOST_RUNNING=1` dev
flag is set.

### Failure presentation

| Failure                     | User sees                                                 |
| --------------------------- | --------------------------------------------------------- |
| Host binary missing         | Desktop error: installation incomplete                    |
| Host exit during boot       | Desktop error: startup failed + message from logs         |
| Host unreachable after open | Client connection error screen                            |
| Platform blocked            | Client blocked/maintenance screen from `/api/data/status` |

## Stubs for parallel development

When the real host is unavailable, client and desktop may target
`apps/passbook/fixtures/host-stub/` if it implements:

- the health, status, tRPC, and upload/file routes listed above;
- fixture responses for the proof workflow using fictional IDs;
- deterministic errors for `503` maintenance simulation.

Stubs must be removable by changing `PASSBOOK_HOST_URL` only. Remove stub
dependencies from production desktop builds.

## Handoff format between assignments

Each assignment ends with:

1. **Deliverables** — paths created or changed
2. **Config** — env vars and default ports
3. **Verification** — commands run and results
4. **Contract gaps** — any proposed contract change (requires baseline owner review)
5. **Integration notes** — what the next assignment should expect

## Versioning note

Contract version: **foundation-1** (October 2026 baseline). Increment only through
maintainer-reviewed updates to this file and [baseline.md](./baseline.md).
