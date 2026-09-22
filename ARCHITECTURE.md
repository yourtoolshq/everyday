# Your Tools — Platform Architecture

This document describes the current monorepo structure and how applications stay isolated. It does not replace per-app engineering notes.

## Monorepo layout

```
everyday/
├── apps/           Four Next.js applications (independent deployables)
├── packages/       Reserved for future shared application code (empty)
├── tooling/        Shared dev config (@yourtoolshq/tsconfig, eslint-config, prettier-config)
├── turbo/          Package generator
└── docs/           Platform-phase documentation (e.g. phase-1 verification)
```

**Workspace:** 8 pnpm packages — root, 4 apps, 3 tooling packages. Managed with `pnpm@10.28.2` and Turborepo.

## Application isolation

Each app under `apps/<name>/` is a self-contained Next.js application with:

- Its own `package.json`, database schema, and migrations
- Its own SQLite database and document storage (local `.data/` in development)
- Its own `Dockerfile` and `docker-compose.yml`
- Its own tests and Playwright E2E suite

Apps do not import from each other. Cross-app integration (e.g. Taxbook ↔ Tenure) uses HTTP APIs and configurable base URLs, not shared code packages.

## Development ports

| Application | Dev port |
| ----------- | -------- |
| Taxbook     | 3000     |
| First Aid   | 3001     |
| Passbook    | 3002     |
| Tenure      | 3003     |

E2E tests use port **3100** with isolated `.data/e2e.db` per app run.

## Docker build pattern

Images build from the **repository root** using `turbo prune <app> --docker`:

```bash
pnpm docker:build:taxbook   # docker build -f apps/taxbook/Dockerfile -t taxbook .
```

`docker-compose.yml` in each app sets `context: ../..` so prune output and lockfile resolve correctly. Health checks hit `/api/health` inside the container.

## Shared tooling (not shared application code)

`tooling/` provides consistent TypeScript, ESLint, and Prettier configuration. Application logic and UI remain in each app until a `shared-candidate` is validated and promoted (see [DEVELOPMENT.md](./DEVELOPMENT.md)).

## What this document is not

- Per-app domain models → app `docs/domain.md` or `DOMAIN.md`
- UI conventions → app docs and future design system
- Deployment topology → legacy repos until Phase 4; Traefik hostnames documented in [docs/phase-1/baseline.md](./docs/phase-1/baseline.md)
