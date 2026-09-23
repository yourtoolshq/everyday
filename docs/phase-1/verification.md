# Phase 1 — Verification Results

Recorded from a clean monorepo checkout after app imports, workspace adaptation, and Phase 1 handoff checks.

**Verified:** 2026-09-22

## Workspace

| Check                                        | Result |
| -------------------------------------------- | ------ |
| Single `pnpm-lock.yaml` at root              | Pass   |
| `pnpm install --frozen-lockfile`             | Pass   |
| Turbo package graph (8 packages)             | Pass   |
| `git log taxbook-src/main` history reachable | Pass   |

## Quality gates

| Task        | taxbook          | firstaid | passbook         | tenure           |
| ----------- | ---------------- | -------- | ---------------- | ---------------- |
| `typecheck` | Pass             | Pass     | Pass             | Pass             |
| `lint`      | Pass (1 warning) | Pass     | Pass (1 warning) | Pass (1 warning) |
| `test`      | Pass             | Pass     | Pass             | Pass             |
| `build`     | Pass¹            | Pass     | Pass             | Pass             |

¹ Taxbook build requires `SKIP_ENV_VALIDATION=1` and a temporary `DATABASE_URL` (encoded in the app `build` script, matching Docker builder behavior).

## Monorepo adaptations applied

- Removed per-app lockfiles; dependencies resolved from root catalog
- Added app-level `turbo.json` with Next.js build outputs and persistent `dev`
- Dockerfiles use `turbo prune <app> --docker` from monorepo root context
- `docker-compose.yml` build context points to repository root
- Pinned `eslint-plugin-react-hooks@5.2.0` via pnpm override to preserve pre-import lint behavior
- Docker runner stage copies builder `node_modules` so entrypoint migrations resolve `drizzle-orm`

## Extended verification (Phase 1 handoff)

| Check                                     | Result | Notes                                                                                          |
| ----------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| Playwright E2E (serial per app)           | Pass   | All four apps; Taxbook runs spec files in separate Playwright invocations for DB isolation     |
| Pruned Docker image build                 | Pass   | `pnpm docker:build:<app>` for taxbook, tenure, firstaid (`firstaid:verification` also present) |
| Docker container health (`/api/health`)   | Pass   | Verified on rebuilt taxbook image after runner `node_modules` fix                              |
| Simultaneous `pnpm dev` (ports 3000–3003) | Pass   | All four `/api/health` endpoints respond                                                       |
| Taxbook ↔ Tenure connectivity             | Pass   | Tenure integration API (`/api/integration/employments`) reachable while both apps run locally  |
| Isolated backup validation                | Pass   | Representative SQLite copy in `.validation/` passes `pragma integrity_check`                   |

### E2E commands used

```bash
cd apps/taxbook && CI=true pnpm test:e2e
cd apps/firstaid && CI=true pnpm test:e2e
cd apps/passbook && CI=true pnpm test:e2e
cd apps/tenure && CI=true pnpm test:e2e
```

### Docker health command

```bash
docker run -d --name <app>-hc -p 13000:3000 <app>
curl -sf http://127.0.0.1:13000/api/health
docker rm -f <app>-hc
```

### Backup validation

Isolated copies live under gitignored `.validation/`. Never attach validation containers to production volume names (`taxbook-data`, `passbook-data`, `tenure-data`, `firstaid-data`). Full Docker restore scripts require a running app container and maintainer-owned backup files; integrity of isolated copies is verified with SQLite `pragma integrity_check`.

## Rollback

Delete this experimental checkout, any validation containers, and `.validation/` data. Continue running the untouched source repositories and production Docker volumes.
