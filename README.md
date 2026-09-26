# Your Tools — Platform

Your Tools is a collection of open-source, self-hosted applications for everyday personal and household problems.

This repository is the development source of truth for consolidating four existing applications into a shared Turborepo platform. The original application repositories remain the production environments until Phase 4 cutover is complete.

## Applications

| Application   | Package    | Dev port | Purpose                                                |
| ------------- | ---------- | -------- | ------------------------------------------------------ |
| **Taxbook**   | `taxbook`  | 3000     | Personal taxes, receipts, returns, and tax planning    |
| **First Aid** | `firstaid` | 3001     | Healthcare records, benefits, appointments, and claims |
| **Passbook**  | `passbook` | 3002     | Financial institutions, accounts, and statements       |
| **Tenure**    | `tenure`   | 3003     | Employment history, compensation, and pay stubs        |

## Getting started

Requires Node.js 22+ and pnpm 10.28.2 (enforced via `packageManager`).

```bash
pnpm install
pnpm dev                    # all apps (ports 3000–3003)
pnpm dev:taxbook            # single app
pnpm check                  # format + lint + typecheck + test + build (all apps)
pnpm check:taxbook          # scoped quality gates for one app
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

Filter by app with Turbo:

```bash
pnpm turbo run build -F taxbook
pnpm turbo run test -F passbook
pnpm turbo run test:e2e -F tenure
```

Docker builds use `turbo prune` from the monorepo root:

```bash
pnpm docker:build:taxbook
cd apps/taxbook && docker compose up --build
```

## Repository layout

```
apps/        Taxbook, Passbook, Tenure, First Aid
packages/    Reserved for future shared application code (empty in Phase 1)
tooling/     @yourtoolshq/tsconfig, eslint-config, prettier-config
turbo/       Package generator (`pnpm gen`)
```

## Documentation

| Document                                              | Purpose                                        |
| ----------------------------------------------------- | ---------------------------------------------- |
| [PRODUCT.md](./PRODUCT.md)                            | Platform purpose and boundaries                |
| [ARCHITECTURE.md](./ARCHITECTURE.md)                  | Monorepo structure and app isolation           |
| [DEVELOPMENT.md](./DEVELOPMENT.md)                    | Workflow, checks, and production boundary      |
| [AGENTS.md](./AGENTS.md)                              | Entry point for coding agents                  |
| [ROADMAP.md](./ROADMAP.md)                            | Phased consolidation plan                      |
| [Phase 3 audit](./docs/phase-3/architecture-audit.md) | Architecture decisions and candidate inventory |

## Philosophy

See the [Your Tools manifesto](https://your-tools.dev/) for the motivation and principles behind these tools.

## Status

**Phases 1 and 2** are complete. **Phase 3** (architecture inventory) is under
review. See [ROADMAP.md](./ROADMAP.md), [docs/phase-1/](./docs/phase-1/), and the
[Phase 3 audit](./docs/phase-3/architecture-audit.md) for details.
