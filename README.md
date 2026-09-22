# Your Tools — Platform

Your Tools is a collection of open-source, self-hosted applications for everyday personal and household problems.

This repository is the experimental development workspace for consolidating four existing applications into a shared Turborepo platform. The original application repositories remain the production environments until the monorepo is proven stable.

## Applications

| Application | Package | Dev port | Purpose |
|---|---|---|---|
| **Taxbook** | `taxbook` | 3000 | Personal taxes, receipts, returns, and tax planning |
| **First Aid** | `firstaid` | 3001 | Healthcare records, benefits, appointments, and claims |
| **Passbook** | `passbook` | 3002 | Financial institutions, accounts, and statements |
| **Tenure** | `tenure` | 3003 | Employment history, compensation, and pay stubs |

## Getting started

Requires Node.js 22+ and pnpm 10.28.2 (enforced via `packageManager`).

```bash
pnpm install
pnpm dev                    # all apps (ports 3000–3003)
pnpm dev:taxbook            # single app
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

Filter by app:

```bash
pnpm turbo run build -F taxbook
pnpm turbo run test -F passbook
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

## Philosophy

See the [Your Tools manifesto](https://your-tools.dev/) for the motivation and principles behind these tools.

## Status

Phase 1 workspace consolidation is in progress. The full plan lives in [ROADMAP.md](./ROADMAP.md). Import baselines and verification notes are in [docs/phase-1/](./docs/phase-1/).
