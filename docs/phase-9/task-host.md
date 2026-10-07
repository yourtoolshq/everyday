# Phase 9 — Passbook host foundation brief

Standalone assignment to make Passbook's data-owning host runnable without
Next.js. Read [baseline.md](./baseline.md) and [contracts.md](./contracts.md)
first.

**Status:** Blocked until maintainer marks this row Ready in
[integration-plan.md](./integration-plan.md#ready--blocked--later).

## Required reading

- Root [AGENTS.md](../../AGENTS.md) and linked platform docs
- [docs/phase-9/baseline.md](./baseline.md)
- [docs/phase-9/contracts.md](./contracts.md)
- [docs/phase-4/data-platform.md](../phase-4/data-platform.md) — boot, readiness, uploads
- [apps/passbook/AGENTS.md](../../apps/passbook/AGENTS.md) and Passbook product/domain docs
- ADRs [0001](../adr/0001-independent-desktop-applications.md),
  [0002](../adr/0002-app-owned-hosts-and-multiple-clients.md)

## Permitted file ownership

**May create or edit:**

- `apps/passbook/host/**` (new package)
- `apps/passbook/shared/server/**` — extract shared imports only; avoid breaking Next routes
- `apps/passbook/package.json` — scripts that delegate to host, if needed
- Host-specific env module under `apps/passbook/host/`
- Host unit/integration tests under `apps/passbook/host/`
- `apps/passbook/fixtures/host-stub/**` if needed for self-test

**May read but not break:**

- `apps/passbook/shared/app/api/**` — keep Next handlers working until cutover
- `packages/data/**` — prefer host adapter over changing platform semantics

**Do not edit:**

- `apps/passbook/client/**`, `apps/passbook/desktop/**`
- Other apps, root turbo/workspace (integration owner)
- Production Docker/Nix configuration

## Requirements

1. Create `apps/passbook/host` workspace package with a `dev` and `start`
   script that boots the data platform and listens for HTTP.
2. Serve `/api/trpc` using existing `appRouter` and `createTRPCContext`.
3. Serve `/api/data/*` and `/api/health` with behavior matching current Next
   routes (see `src/app/api/data/[...path]/route.ts`,
   `src/server/health.ts`).
4. Call `dataPlatform.boot()` once at process startup (replace Next
   instrumentation for this process only).
5. Default bind: `127.0.0.1:3847` (or value recorded in contracts after
   integration owner sync).
6. Log structured startup/shutdown events via `@yourtoolshq/server/log`.
7. Ship a disposable-data integration script or documented curl/tRPC sequence
   that proves setup → account → statement upload → restart persistence.

## Exclusions

- UI, Electron, routing, or static assets
- Authentication, remote bind, TLS
- Packaging (AppImage/dmg/msi)
- Replacing or deleting the Next.js app
- Extracting shared packages for other apps
- Changing Drizzle schema or migrations except through existing app processes

## Dependencies

| Depends on                                      | Reason                      |
| ----------------------------------------------- | --------------------------- |
| Phase 9 baseline + contracts (maintainer Ready) | Configuration and lifecycle |
| `@yourtoolshq/data`, existing Passbook routers  | Runtime behavior            |

| Blocks             | Reason                                    |
| ------------------ | ----------------------------------------- |
| Client assignment  | Needs real host URL for final integration |
| Desktop assignment | Spawns host binary                        |
| Integration gate   | Requires running host                     |

Client/desktop may proceed earlier against `host-stub` per contracts.

## Verification

```bash
# From repository root after implementation
pnpm check:passbook-host   # add script: lint, typecheck, test for host package
cd apps/passbook/host
DATA_DIR=./.data/host-test BACKUP_DIR=./.data/host-test/backups pnpm dev
# In another shell — fictional workflow
curl -s http://127.0.0.1:3847/api/health
# Document tRPC sequence or run host/integration.test.ts
```

Also confirm existing Next app still passes:

```bash
pnpm check:passbook
```

Use fictional household names and PDF fixtures only.

## Acceptance criteria

- [ ] Host starts, boots data platform, and serves health on loopback
- [ ] tRPC procedures for the proof workflow succeed against disposable `DATA_DIR`
- [ ] File upload and download work for `document` endpoint
- [ ] Platform maintenance/blocked states return contract-compliant responses
- [ ] Restarting host preserves SQLite and managed documents
- [ ] Next.js Passbook still builds and tests pass unchanged
- [ ] Handoff document lists env vars, ports, and any contract gaps

## Stop conditions

Stop and request baseline review if:

- Implementing the HTTP adapter requires changing `@yourtoolshq/data` public behavior
- tRPC routers cannot run outside Next without duplicating large router code
- Default port conflicts cannot be resolved within integration owner scope
- Schema or migration changes appear necessary for the proof workflow

## Handoff format

Post in the assignment PR or issue comment:

```markdown
## Host foundation handoff

### Deliverables

- ...

### Configuration

- PASSBOOK_HOST_URL=...
- DATA_DIR=...

### Verification

- [ ] pnpm check:passbook-host
- [ ] pnpm check:passbook
- [ ] restart persistence script

### Contract gaps

- none | ...

### Notes for client/desktop

- binary path: ...
- stub parity: ...
```
