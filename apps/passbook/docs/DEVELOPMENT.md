# Development

Passbook is a **desktop product**: Electron loads a Vite client that talks to a loopback **host**. Shared domain code, UI, and server logic live under `shared/`. Platform libraries live in the monorepo root `packages/` (`@yourtoolshq/*`).

## Layout

```text
apps/passbook/
  host/       # HTTP server (tRPC, data routes, auth, static client in production)
  client/     # Vite SPA (routes, tRPC client, gates)
  desktop/    # Electron shell, packaging, updates
  shared/     # lib/, server/, components/, styles/ — Passbook-only
  drizzle/    # SQL migrations
  e2e/        # Playwright (host + client stack)
  scripts/    # CI gates, release helpers
```

## Prerequisites

Node.js 22 and pnpm 10 (from the repository root).

## Local development

From the monorepo root:

```sh
pnpm install
pnpm dev:passbook
```

That runs the **host** and **client** dev servers. Open the client URL printed by Vite (default `http://127.0.0.1:5173`). Data defaults to `apps/passbook/.data/`.

For the full desktop shell:

```sh
cd apps/passbook/desktop
pnpm dev
```

Optional environment variables:

```sh
DATA_DIR=./.data
PORT=3847          # host listen port
PASSBOOK_HOST_URL=http://127.0.0.1:3847
```

## Verification

From the repository root:

```sh
pnpm check:passbook
pnpm check:passbook-host
pnpm check:passbook-client
pnpm check:passbook-desktop
```

Passbook-specific gates (disposable data only):

```sh
pnpm foundation:gate
pnpm remote-access:gate
pnpm release:gate
pnpm migration-rehearsal:gate
```

Playwright E2E (host + client):

```sh
pnpm --filter passbook exec playwright install chromium
pnpm --filter passbook test:e2e
```

## Data and migrations

SQLite and documents live under `DATA_DIR` (default `.data/`). Managed documents are under `DATA_DIR/documents`.

```sh
cd apps/passbook
pnpm db:generate   # after schema changes — see ENGINEERING.md
pnpm db:migrate
pnpm data backup
pnpm data list
pnpm data restore <backup id>
```

## macOS package (unsigned)

```sh
pnpm package:passbook:mac
```

Artifacts land in `apps/passbook/desktop/release/`. See `desktop/README.md` for Gatekeeper notes.

## Documents

Account documents are managed copies under `DATA_DIR/documents`. Uploads accept one PDF, image (JPEG, PNG, WebP, HEIC), EML, or audio (MP3, M4A, WAV, OGG) file at a time, up to 25 MB.

Recovery procedures are documented in the platform [data platform recovery runbook](../../../docs/phase-4/data-platform.md#recovery-runbook).
