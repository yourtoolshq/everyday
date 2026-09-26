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

The tooling packages are established, but the applications still retain local
TypeScript and ESLint copies. Consuming the shared presets is a Phase 6
candidate; this document does not claim that migration is already complete.

## Application architecture direction

Phase 3 established a lightweight, DDD-inspired vertical-slice direction for
new or substantially changed code. Existing code migrates incrementally; a
localized fix does not require reorganizing its whole feature first.

```text
src/
├── app/                         Next.js routes and composition
├── core/                        Small app-wide concepts and infrastructure
├── modules/
│   └── <feature>/
│       ├── domain/              Pure rules, types, and validation
│       ├── application/         Use cases and explicit DTOs
│       ├── infrastructure/      Repositories and external adapters
│       └── presentation/        Feature UI and client orchestration
└── components/ui/               Low-level visual primitives
```

Small slices may remain a few colocated files. The named directories are
boundaries, not required empty scaffolding.

### Dependency direction

- Routes and tRPC routers adapt transport concerns; they do not own business
  rules.
- Domain code does not import React, Next.js, tRPC, Drizzle, database schema,
  or filesystem implementation.
- Application operations coordinate repositories, transactions, and domain
  rules.
- A feature repository is the only feature code that executes its database
  queries.
- Repositories return explicit domain objects or read DTOs and accept explicit
  write commands. They do not expose unrestricted rows or spread requests into
  writes.
- Repository projections are the audit boundary for keeping sensitive or
  internal fields out of application and transport data.
- Prefer one concrete repository. Add an interface only when a real second
  adapter exists; do not add generic base repositories or a dependency-injection
  container.
- App-wide database, storage, logging, and error infrastructure belongs in
  app-local `core/infrastructure` until promotion is validated.

Taxbook's domain modules and `*-values.ts` files are the closest existing
reference, but they are not a template to copy unchanged: some remain large and
mix application, persistence, and transport errors. The detailed evidence and
candidate decisions live in the
[Phase 3 audit](./docs/phase-3/architecture-audit.md).

## What this document is not

- Per-app domain models → app `docs/domain.md` or `DOMAIN.md`
- UI conventions → app docs and future design system
- Deployment topology → legacy repos until Phase 4; Traefik hostnames documented in [docs/phase-1/baseline.md](./docs/phase-1/baseline.md)
