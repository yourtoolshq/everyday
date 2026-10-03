# Phase 9 — Passbook client foundation brief

Standalone assignment to deliver a React SPA that connects to the Passbook
host and completes the proof workflow without Next.js. Read
[baseline.md](./baseline.md) and [contracts.md](./contracts.md) first.

**Status:** Blocked until maintainer marks this row Ready in
[integration-plan.md](./integration-plan.md#ready--blocked--later).

## Required reading

- Root [AGENTS.md](../../AGENTS.md) and [DESIGN_LANGUAGE.md](../../DESIGN_LANGUAGE.md)
- [docs/phase-9/baseline.md](./baseline.md)
- [docs/phase-9/contracts.md](./contracts.md)
- [apps/passbook/AGENTS.md](../../apps/passbook/AGENTS.md),
  [docs/ENGINEERING.md](../../apps/passbook/docs/ENGINEERING.md)
- Existing UI references: `accounts-workspace.tsx`, `account-detail-workspace.tsx`,
  `statement-upload-sheet.tsx`, `setup-form.tsx`

## Permitted file ownership

**May create or edit:**

- `apps/passbook/client/**` (new Vite package)
- Copied/adapted components under `apps/passbook/client/src/**` sourced from
  `apps/passbook/src/components/**` and `src/lib/**` (prefer imports from app
  paths or shared copies — do not break Next imports)
- Client routing, env, and tRPC provider configuration
- Client Playwright or Vitest tests under `apps/passbook/client/`
- Tailwind config scanning `@yourtoolshq/ui` and `@yourtoolshq/data-ui`

**Do not edit:**

- `apps/passbook/host/**` except reading contract examples
- `apps/passbook/desktop/**`
- `apps/passbook/src/server/**`
- `apps/passbook/src/app/**` (Next production path)
- Root workspace tooling (integration owner)

## Requirements

1. Vite + React SPA with client-side routing for:
   - `/setup`
   - `/` dashboard (overview)
   - `/accounts`, `/accounts/:accountId`
   - `/institutions` (list minimum for workflow)
   - `/files/:fileId` viewer
2. Configure tRPC client per [contracts.md](./contracts.md) using
   `PASSBOOK_HOST_URL`.
3. Implement connection and platform gates (health + maintenance/blocked) before
   rendering the app shell.
4. Reuse existing workspace/sheet/dialog UI patterns and fictional-data copy.
5. Support proof workflow without RSC:
   - setup → institution → account → statement upload → missing view → document
     upload/open
6. Point `@yourtoolshq/data-ui` upload helpers at host data HTTP URLs.
7. Provide `pnpm dev` for client-only development against `host-stub` or real
   host.

## Exclusions

- Electron or host process management
- Data settings / backup management UI (full `DataSettingsPage`) — Later
- Account events, terms, activity pages not required for proof workflow
- Authentication
- Replacing Next app or changing server routers
- New domain features beyond existing tRPC surface

## Dependencies

| Depends on                              | Reason              |
| --------------------------------------- | ------------------- |
| Contracts + baseline (maintainer Ready) | URLs, gates, errors |
| `host-stub` **or** real host            | API target          |

| Parallel with      | Notes                                               |
| ------------------ | --------------------------------------------------- |
| Host assignment    | Use stub first; switch to real host for integration |
| Desktop assignment | Desktop loads client dev server or build output     |

## Verification

Development against stub:

```bash
cd apps/passbook/fixtures/host-stub && pnpm dev   # when stub exists
cd apps/passbook/client
PASSBOOK_HOST_URL=http://127.0.0.1:3847 pnpm dev
```

Package checks (implementer adds):

```bash
pnpm check:passbook-client
```

Integration with real host (after host Ready):

```bash
# terminal 1: host with disposable data
# terminal 2: client
# manual or playwright: setup → upload → missing statements visible
```

Reference behavior: existing E2E in `apps/passbook/e2e/setup.spec.ts` and
`uploads.spec.ts` (adapt URLs for split architecture).

## Acceptance criteria

- [ ] Client connects to configurable host URL
- [ ] Connection, maintenance, and blocked states match contracts
- [ ] Proof workflow completable with fictional data
- [ ] Statement upload satisfies period; missing-statement UI updates
- [ ] PDF served from host opens in viewer route
- [ ] No imports from `next/*`, `~/trpc/server`, or RSC-only APIs
- [ ] Handoff lists routes, env vars, and stub vs real host testing

## Stop conditions

Stop and request baseline review if:

- Required UI cannot function without RSC data paths
- tRPC batch/link setup requires contract changes
- Data-ui upload helpers cannot target external host without package changes
- Scope expands beyond proof workflow pages

## Handoff format

```markdown
## Client foundation handoff

### Deliverables

- ...

### Configuration

- PASSBOOK_HOST_URL=...
- Vite dev URL=...

### Verification

- [ ] pnpm check:passbook-client
- [ ] proof workflow against stub
- [ ] proof workflow against real host (when available)

### Contract gaps

- none | ...

### Notes for desktop/integration

- build output path: ...
- dev server port: ...
```
