# Phase 9 — Passbook implementation baseline

Planning inventory: October 2026. [ROADMAP.md](../../ROADMAP.md#phase-9--distribution-future)
owns phase goals. This document resolves the minimum technical baseline for the
first Passbook host/client/desktop foundation wave.

## Outcome

Prove one complete local Passbook workflow through three new runtime components
while keeping the existing monorepo, four independent products, and current
Next.js/Docker production path intact until a later cutover.

The proof workflow answers:

> Which financial statements am I missing?

using fictional data only.

## Smallest complete workflow

The integration gate exercises this sequence end to end:

| Step | User-visible outcome                   | Existing operations                                                         |
| ---- | -------------------------------------- | --------------------------------------------------------------------------- |
| 1    | First launch shows setup               | `setup.state`, `setup.initialize`                                           |
| 2    | Household dashboard loads              | `overview.summary`                                                          |
| 3    | Create institution and monthly account | `institutions.create`, `people.list`, `accounts.create`                     |
| 4    | Upload a statement PDF for a period    | `POST /api/data/upload/document`, `documents.create`                        |
| 5    | Missing-statement view updates         | `overview.statementStatus`                                                  |
| 6    | Upload and open an account document    | upload + `documents.create`, `GET /api/data/files/:id`, `/files/:id` viewer |
| 7    | Restart host; records and files remain | `dataPlatform.boot()` persistence under `DATA_DIR`                          |

Evidence paths for each step appear in [Migration boundary inventory](#migration-boundary-inventory).

Out of scope for the first wave: account events, terms snapshots, data settings
screens beyond a minimal blocked/maintenance gate, remote authenticated access,
packaged installers, and automatic updates.

## First supported target

| Topic                   | Status                                  | Recommendation                                                                                                                                                                                                                     |
| ----------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application             | **Established**                         | Passbook first; validate a second app before generic shared runtime extraction                                                                                                                                                     |
| Monorepo                | **Established**                         | Keep Turborepo + pnpm workspaces; shared packages stay workspace-local                                                                                                                                                             |
| Host runtime            | **Proposed**                            | Node.js 22 standalone HTTP process; reuse existing tRPC routers and `@yourtoolshq/data`                                                                                                                                            |
| Client runtime          | **Proposed**                            | Vite + React SPA; reuse existing client components and tRPC React Query client                                                                                                                                                     |
| Desktop runtime         | **Proposed**                            | Electron main process wrapping the SPA and supervising the host                                                                                                                                                                    |
| Initial desktop OS/arch | **Blocked — maintainer input required** | Leading candidate: **Linux x86_64** (matches the existing Nix-managed production host). macOS and Windows remain Later until daily-use target is confirmed. A macOS development checkout does not establish the production target. |
| Packaging format        | **Later**                               | AppImage or `.deb` on Linux after the integration gate; not part of foundation wave                                                                                                                                                |
| Remote access / auth    | **Later**                               | Local loopback only; no public exposure of currently unauthenticated routes                                                                                                                                                        |

## Technical recommendation

### Host

Run Passbook business operations in a **standalone Node host** that is not
Next.js:

- Boot with `dataPlatform.boot()` from `apps/passbook/src/server/data.ts`.
- Serve existing tRPC procedures from `apps/passbook/src/server/api/root.ts`
  at `/api/trpc`.
- Serve data-platform HTTP routes (upload, files, status) using the same
  behavior as `createDataHandlers` in
  `packages/data/src/next/handlers.ts`, adapted to the host HTTP stack.
- Expose `/api/health` using `createHealthResponse` from
  `apps/passbook/src/server/health.ts`.
- Bind to loopback by default (`127.0.0.1`) on a configurable port.

**Established facts:** tRPC + SuperJSON, Drizzle/libSQL, and
`requireReady(dataPlatform)` already gate mutations while the platform is not
ready (`packages/data/src/readiness.ts`).

**Proposed choice:** implement the HTTP adapter with Node's built-in
`node:http` or a minimal framework (for example Hono). Pick one during the host
assignment; do not block on a large framework comparison.

**Not selected yet:** TLS termination, mTLS, remote bind address, process
supervisor beyond desktop shell.

### Client

Replace Next.js presentation with a **Vite React SPA** that:

- Loads routes for setup, dashboard, accounts, institutions, documents, and file
  viewer pages currently under `apps/passbook/src/app/(app)/` and `/setup`.
- Reuses components from `apps/passbook/src/components/` and hooks from
  `apps/passbook/src/lib/uploads.ts`.
- Connects to the host through configurable base URLs for tRPC (`/api/trpc`) and
  data HTTP (`/api/data/*`).
- Drops React Server Components and `~/trpc/server` callers; fetches in client
  components or route loaders only.

**Proposed choice:** React Router for client-side navigation.

### Desktop shell

An **Electron** application that:

- Starts the Passbook host as a child process before opening the client window.
- Loads the built client (dev: Vite dev server URL; prod: `file://` or bundled
  static assets).
- Keeps the host running when the window closes (ADR-0002 success criteria).
- Surfaces host startup failure in the window before the client connects.

**Deferred:** code signing, auto-update, tray/menu polish, multi-window.

## Repository and package ownership

New workspace packages under Passbook; the existing Next app remains until
cutover:

| Path                                                     | Owner                        | Role                                                    |
| -------------------------------------------------------- | ---------------------------- | ------------------------------------------------------- |
| `apps/passbook/host/`                                    | Host brief                   | Standalone Node host entrypoint and HTTP adapter        |
| `apps/passbook/client/`                                  | Client brief                 | Vite SPA, routing, host connection config               |
| `apps/passbook/desktop/`                                 | Desktop brief                | Electron main/preload, host lifecycle                   |
| `apps/passbook/fixtures/host-stub/`                      | Integration plan             | Contract-faithful stub for parallel client/desktop work |
| `apps/passbook/src/server/**`                            | Host brief (read/adapt)      | Existing tRPC routers, data wiring, health              |
| `apps/passbook/src/lib/**`                               | Shared (read-only in wave 1) | Domain logic reused by host                             |
| `apps/passbook/src/components/**`                        | Client brief (copy/adapt)    | UI reused by SPA                                        |
| `apps/passbook/src/app/**`                               | Unchanged in wave 1          | Current Next production path                            |
| Root `package.json`, `turbo.json`, `pnpm-workspace.yaml` | Integration owner            | Scripts and workspace entries for new packages          |

Do **not** extract a generic `@yourtoolshq/runtime` package in this wave.
Record shared-runtime candidates in the Phase 3 audit after Passbook proves the
pattern and a second app validates it.

## Migration boundary inventory

### Reuse unchanged (move or import into host/client)

| Area                        | Paths                                                                                                                                      | Evidence                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Domain rules                | `apps/passbook/src/lib/statement-completeness.ts`, `expected-periods.ts`, `documents.ts`, `statement-frequency.ts`, `account-status.ts`, … | Vitest coverage in matching `*.test.ts` files       |
| Statement upload validation | `apps/passbook/src/server/documents/statement-upload.ts`                                                                                   | Called from `documents` router                      |
| Vertical-slice module       | `apps/passbook/src/modules/institutions/**`                                                                                                | `institution-repository.test.ts`                    |
| Data platform contract      | `apps/passbook/src/server/data.ts`, `src/server/db/schema.ts`, `drizzle/`                                                                  | `defineDataPlatform({ app: "passbook", … })`        |
| File router                 | `apps/passbook/src/server/files.ts`                                                                                                        | Endpoints `document`, `institutionIcon`             |
| tRPC API surface            | `apps/passbook/src/server/api/root.ts`, routers under `routers/`                                                                           | Used by Playwright helpers in `e2e/uploads.spec.ts` |
| Readiness middleware        | `requireReady(dataPlatform)` in `src/server/api/trpc.ts`                                                                                   | Maps platform states to `SERVICE_UNAVAILABLE`       |
| Health semantics            | `apps/passbook/src/server/health.ts`                                                                                                       | Maintenance returns 200; DB failure returns 503     |
| Upload helpers              | `apps/passbook/src/lib/uploads.ts`                                                                                                         | Wraps `@yourtoolshq/data-ui` upload helpers         |
| UI workspaces               | `apps/passbook/src/components/**`                                                                                                          | E2E exercises account detail, uploads, viewer       |

### Tied to Next.js (replace in client/host split)

| Area                      | Paths                                               | Adaptation                                                       |
| ------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| App Router pages          | `apps/passbook/src/app/**`                          | SPA routes + client data fetching                                |
| RSC tRPC                  | `apps/passbook/src/trpc/server.ts`                  | Remove; use client tRPC only                                     |
| Next instrumentation boot | `apps/passbook/src/instrumentation.ts`              | Host calls `dataPlatform.boot()` at process start                |
| Next data route adapter   | `apps/passbook/src/app/api/data/[...path]/route.ts` | Host-native data HTTP handler                                    |
| Next tRPC route           | `apps/passbook/src/app/api/trpc/[trpc]/route.ts`    | Host-native tRPC handler                                         |
| Next health route         | `apps/passbook/src/app/api/health/route.ts`         | Host `/api/health`                                               |
| Server `DataGate` layout  | `apps/passbook/src/app/(app)/layout.tsx`            | Client-side gate using `/api/data/status` or tRPC error handling |
| SSR household redirect    | `RequireHousehold` in `(app)/layout.tsx`            | Client route guard calling `setup.state`                         |
| Next env helper           | `apps/passbook/src/env.js`                          | Host/client env modules (`@t3-oss/env-core` or zod)              |
| Standalone Next build     | `next.config.js`, `Dockerfile`                      | Unchanged until production cutover                               |
| E2E server                | `playwright.config.ts` webServer                    | New integration config targeting host+client                     |

### Adapt (keep behavior, change wiring)

| Area              | Paths                                                         | Notes                                                                                    |
| ----------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| tRPC React client | `apps/passbook/src/trpc/react.tsx`                            | `getBaseUrl()` must read host URL config, not `window.location` when client is `file://` |
| Data UI screens   | `@yourtoolshq/data-ui`                                        | Already HTTP-based; point upload/fetch URLs at host                                      |
| File viewer       | `apps/passbook/src/app/files/[fileId]/page.tsx`               | Move to SPA route; keep `FileViewerPage` behavior                                        |
| Setup page        | `apps/passbook/src/app/setup/page.tsx`, `components/setup/**` | SPA entry when `setup.state.initialized === false`                                       |
| Logging/errors    | `apps/passbook/src/core/infrastructure/**`                    | Reuse `@yourtoolshq/server` in host                                                      |

## Compatibility and update boundaries

| Component | Owns                                    | Update replaces       | Data upgrade                                          |
| --------- | --------------------------------------- | --------------------- | ----------------------------------------------------- |
| Host      | SQLite, documents, backups, migrations  | Host binary/container | Runs `@yourtoolshq/data` migration path on boot       |
| Client    | Presentation, local UI preferences only | Client bundle         | None                                                  |
| Desktop   | Process supervision, window             | Desktop installer     | None directly; triggers host restart on upgrade Later |

Client and host versions should tolerate minor skew during development. Before
any managed update (Phase 8/ADR-0003), define an explicit compatibility matrix;
not required for the foundation gate.

## Unresolved decisions (maintainer)

1. **Initial desktop OS/architecture** — blocks desktop packaging and native
   dependency choices.
2. **Host listen address for desktop** — default `127.0.0.1` assumed; confirm
   whether LAN-only remote preview is in scope for foundation wave (recommended:
   no).
3. **Keep Next dev path during transition** — recommended yes until integration
   gate passes; confirm cutover timing.
4. **HTTP adapter library** — host assignee selects within the proposed Node
   minimal-server approach.

## Related verification today

Existing checks that bound the reused behavior:

```bash
pnpm check:passbook
cd apps/passbook && pnpm test:e2e
```

Foundation implementations add package-scoped checks documented in
[integration-plan.md](./integration-plan.md).
