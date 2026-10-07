# Your Tools — Platform Architecture

This document describes the current monorepo structure and how applications stay isolated. It does not replace per-app engineering notes.

## Monorepo layout

```
everyday/
├── apps/           Product applications (mostly Next.js + Docker; Passbook is desktop)
├── packages/       Shared libraries (data, data-ui, ui, server)
├── tooling/        Shared dev config (@yourtoolshq/tsconfig, eslint-config, prettier-config)
├── turbo/          Package generator
└── docs/           Platform-phase documentation
```

**Workspace:** root, 4 apps, 4 shared packages, 3 tooling packages. Managed with
`pnpm@10.28.2` and Turborepo.

## Application isolation

Each product under `apps/<name>/` is isolated:

- Its own `package.json`, database schema, and migrations (where applicable)
- Its own SQLite database and document storage (local `.data/` in development)
- Its own tests and Playwright E2E suite where applicable

Taxbook, First Aid, and Tenure remain **Next.js + Docker** deployables. **Passbook**
is a **desktop product**: `host/`, `client/`, `desktop/`, and Passbook-only code in
`shared/` (see `apps/passbook/AGENTS.md`). Passbook does not ship a Docker image
from this repository.

Apps do not import from each other. Cross-app integration (e.g. Taxbook ↔ Tenure) uses HTTP APIs and configurable base URLs, not shared code packages.

## Development ports

| Application | Dev port                                                                  |
| ----------- | ------------------------------------------------------------------------- |
| Taxbook     | 3000                                                                      |
| First Aid   | 3001                                                                      |
| Passbook    | Vite client `5173`, host `3847` (see `apps/passbook/docs/DEVELOPMENT.md`) |
| Tenure      | 3003                                                                      |

E2E tests use port **3100** with isolated `.data/e2e.db` per app run.

## Docker build and deployment pattern

Images build from the **repository root** using `turbo prune <app> --docker`:

```bash
pnpm docker:build:taxbook   # docker build -f apps/taxbook/Dockerfile -t taxbook .
```

Each app keeps its own `Dockerfile` and `docker-compose.yml`. Compose sets
`context: ../..`, mounts named data and backup volumes at `/data` and
`/backups`, joins the external `web` network, publishes **no** application host
port, and registers the existing `*.tools.local` Traefik hostname. Health checks
hit `/api/health` inside the container. Root `.dockerignore` applies to every
image build.

Disposable isolation checks use each app's `docker-compose.validation.yml` with
a throwaway Compose project name so production volumes and host routes are never
mounted. The full matrix, intentional differences, validation steps, and Nix
host-manager handoff live in
[docs/phase-7/deployment.md](./docs/phase-7/deployment.md).

## Shared packages

| Package                | Owns                                                                |
| ---------------------- | ------------------------------------------------------------------- |
| `@yourtoolshq/data`    | Storage, migrations, backups, restore, integrity (Phase 4)          |
| `@yourtoolshq/ui`      | Shared UI primitives and interaction patterns (Phase 5)             |
| `@yourtoolshq/data-ui` | Data-platform UI surfaces (Phase 5)                                 |
| `@yourtoolshq/server`  | Transport-neutral `AppError` vocabulary and structured JSON logging |

## Shared tooling

`tooling/` provides TypeScript, ESLint, and Prettier configuration. All four
apps extend `@yourtoolshq/tsconfig/nextjs.json` and
`createNextAppConfig(import.meta.dirname)` from `@yourtoolshq/eslint-config/next-app`.
Path aliases (`~/`) and Next-specific options stay in each app. The type-checked
package ESLint preset (`base`) remains for shared packages; `restrictEnvAccess`
stays opt-in until apps fully standardize on `~/env`. Application domains,
databases, and deployments remain per-app.

## Application architecture direction

Phase 3 established a lightweight, DDD-inspired vertical-slice direction for
new or substantially changed code. Existing code migrates incrementally; a
localized fix does not require reorganizing its whole feature first.

```text
src/
├── app/                         Next.js routes and composition
├── core/infrastructure/         App-wide logging and transport error mapping
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

### Adopted Phase 6 examples

- **Tenure** `modules/paychecks`: `listByEmployment` read and `create` write.
- **Taxbook** `modules/records`: `listByTaxItem` read and `delete` write.
- **Passbook** `modules/institutions`: `list` read and `create` write.
- **First Aid** `modules/care-providers`: `overview` read and `createOrganization`
  write.

All four apps map transport-neutral `AppError` values at tRPC (and Taxbook HTTP)
boundaries and emit structured JSON logs on the adopted paths.

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
- Transport-neutral errors live in `@yourtoolshq/server/errors`. Each app maps
  them in `core/infrastructure` for tRPC and HTTP.
- Structured logging uses `@yourtoolshq/server/log` (JSON lines to
  stdout/stderr). Allow-listed context only; apps and `@yourtoolshq/data`
  share the same event shape for adopted paths.

## Proposed release and distribution direction

The [architecture decision records](./docs/adr/README.md) describe proposals for
independent desktop applications, app-owned hosts with multiple clients, and
managed releases with recoverable updates. They capture problems, goals,
alternatives, and tradeoffs at the architectural level. Framework choices and
implementation plans remain for later discussion.

These records are **Proposed** and do not describe changes already implemented.
The current app isolation, deployment contracts, and production promotion rules
remain in effect. [ROADMAP.md](./ROADMAP.md) owns phase sequencing.

## What this document is not

- Per-app domain models → app `docs/domain.md` or `DOMAIN.md`
- UI conventions → [DESIGN_LANGUAGE.md](./DESIGN_LANGUAGE.md) and Phase 5 docs
- Deployment topology → [docs/phase-7/deployment.md](./docs/phase-7/deployment.md);
  Traefik hostnames also appear in [docs/phase-1/baseline.md](./docs/phase-1/baseline.md)
