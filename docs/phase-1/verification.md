# Phase 1 — Verification Results

Recorded from a clean monorepo checkout after app imports and workspace adaptation.

## Workspace

| Check | Result |
|---|---|
| Single `pnpm-lock.yaml` at root | Pass |
| `pnpm install --frozen-lockfile` | Pass |
| Turbo package graph (8 packages) | Pass |
| `git log taxbook-src/main` history reachable | Pass |

## Quality gates

| Task | taxbook | firstaid | passbook | tenure |
|---|---|---|---|---|
| `typecheck` | Pass | Pass | Pass | Pass |
| `lint` | Pass (1 warning) | Pass | Pass (1 warning) | Pass (1 warning) |
| `test` | Pass | Pass | Pass | Pass |
| `build` | Pass¹ | Pass | Pass | Pass |

¹ Taxbook build requires `SKIP_ENV_VALIDATION=1` and a temporary `DATABASE_URL` (encoded in the app `build` script, matching Docker builder behavior).

## Monorepo adaptations applied

- Removed per-app lockfiles; dependencies resolved from root catalog
- Added app-level `turbo.json` with Next.js build outputs and persistent `dev`
- Dockerfiles use `turbo prune <app> --docker` from monorepo root context
- `docker-compose.yml` build context points to repository root
- Pinned `eslint-plugin-react-hooks@5.2.0` via pnpm override to preserve pre-import lint behavior

## Not yet verified in this session

- Playwright e2e (run serially or on non-conflicting ports)
- Pruned Docker image build and health checks for every app
- Simultaneous `pnpm dev` on ports 3000–3003
- Taxbook-to-Tenure integration connectivity
- Representative data restore from isolated `.validation/` backup copies

## Rollback

Delete this experimental checkout, any validation containers, and `.validation/` data. Continue running the untouched source repositories and production Docker volumes.
