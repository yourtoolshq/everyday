# Phase 9 — Passbook foundation integration runbook

Executable verification for issue [#69](https://github.com/yourtoolshq/everyday/issues/69):
host, client, and desktop working together with real persistence.

## Prerequisites

- Node.js 22+
- `pnpm install` at the repository root
- Disposable data only — never use production Docker volumes (`passbook-data`, etc.)

## Quick verification

From the repository root:

```bash
pnpm check:passbook-host
pnpm check:passbook-client
pnpm check:passbook-desktop
cd apps/passbook && pnpm foundation:gate
```

`foundation:gate` runs:

1. **API gate** (`scripts/foundation-gate.mjs`) — health, setup conflict, institution/account,
   statement and document uploads, restart persistence, backup/verify/restore via `yt-data`
2. **Client UI gate** (`playwright.foundation.config.ts`) — setup flow against the real host
   and Vite client

## Manual desktop smoke (optional)

The automated gate does not launch Electron. To verify the desktop shell locally:

```bash
# Terminal 1 — build client and start host-backed stack
cd apps/passbook/client && pnpm build
cd apps/passbook/host && DATA_DIR=./.data/desktop-manual BACKUP_DIR=./.data/desktop-manual/backups pnpm dev

# Terminal 2 — desktop with bundled client (no Vite dev server)
cd apps/passbook/desktop
PASSBOOK_DESKTOP_USE_DIST=1 DATA_DIR=../.data/desktop-manual BACKUP_DIR=../.data/desktop-manual/backups pnpm dev
```

Expected behavior:

- Desktop window opens with the setup screen
- Completing setup shows the household dashboard
- Closing the window hides it; the host keeps running
- Quitting the app stops the supervised host process

## Disposable data locations

| Path                                          | Purpose                                         |
| --------------------------------------------- | ----------------------------------------------- |
| `apps/passbook/.data/foundation-gate`         | API gate (cleaned after run)                    |
| `apps/passbook/.data/foundation-gate-restore` | Restore target (cleaned after run)              |
| `apps/passbook/.data/foundation-e2e`          | Playwright client gate (cleaned on stack start) |
| `apps/passbook/.data/desktop-manual`          | Manual desktop verification                     |

Set `PASSBOOK_KEEP_GATE_DATA=1` to retain API gate data for inspection.

## Environment variables

| Variable                      | Default                                    | Used by                                   |
| ----------------------------- | ------------------------------------------ | ----------------------------------------- |
| `DATA_DIR`                    | `.data/foundation-gate`                    | Host data root                            |
| `BACKUP_DIR`                  | `<DATA_DIR>/backups`                       | Backup archives                           |
| `PORT`                        | ephemeral (API gate) / `3848` (Playwright) | Host listen port                          |
| `PASSBOOK_HOST_URL`           | `http://127.0.0.1:3847`                    | Client host connection                    |
| `PASSBOOK_DESKTOP_USE_DIST`   | unset (dev server)                         | Desktop loads `client/dist` when `1`      |
| `PASSBOOK_LEAVE_HOST_RUNNING` | unset                                      | Desktop quit leaves host running when `1` |

## Gate assertions

| #   | Assertion                                        | Verified by                        |
| --- | ------------------------------------------------ | ---------------------------------- |
| 1   | `GET /api/health` → `status: ok`                 | API gate                           |
| 2   | Second setup rejected with 409                   | API gate                           |
| 3   | Institution + monthly account created            | API gate                           |
| 4   | Statement upload; file bytes retrievable         | API gate                           |
| 5   | `overview.statementStatus` shows period complete | API gate                           |
| 6   | Account document upload + file GET               | API gate                           |
| 7   | Restart persistence (counts + file bytes)        | API gate                           |
| 8   | Backup create + verify via `yt-data`             | API gate                           |
| 9   | Restore into fresh directory preserves data      | API gate                           |
| 10  | Client setup UI against real host                | Playwright gate                    |
| 11  | Host connection error screen (manual)            | Desktop smoke / HostGate component |

## Remaining limitations

- **Desktop packaging** — Electron shell runs from source via `tsx`; no installer yet ([#71](https://github.com/yourtoolshq/everyday/issues/71)).
- **Remote access** — loopback only; no authenticated browser/phone access ([#70](https://github.com/yourtoolshq/everyday/issues/70)).
- **OS target** — Linux x86_64 is the leading candidate; macOS/Windows packaging is Later.
- **Client route parity** — sidebar links to `/members`, `/documents`, `/activity`, and `/settings` are not yet implemented in the SPA; core gate workflow routes are covered.
- **Next.js production path** — unchanged; Docker deployment remains the production path until a later cutover.

## Evidence checklist (for PR handoff)

- [ ] `pnpm check:passbook` passes
- [ ] `pnpm check:passbook-host` passes
- [ ] `pnpm check:passbook-client` passes
- [ ] `pnpm check:passbook-desktop` passes
- [ ] `cd apps/passbook && pnpm foundation:gate` passes
- [ ] Changelog updated for user-visible integration behavior
