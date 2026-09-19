# Tenure

**Your employment history, in your hands.**

Tenure is a local-first, self-hosted app for keeping your employment records together. Open an employer to find your paychecks, compensation changes, important documents, and conversations — even years after leaving the job.

Part of [Your Tools](https://your-tools.dev/), a collection of focused personal tools.

## What it does

- **Employment history:** Keep current and past employers organized in one place.
- **Paychecks:** Record earnings, deductions, and net pay alongside original pay stubs.
- **Compensation history:** See how your salary or hourly rate changed over time.
- **Documents:** Preserve contracts, offer letters, and employment letters.
- **Correspondence:** Save important email exports and notes about employment discussions.

Commission-based compensation tracking and expected-versus-paid reconciliation are planned for a later phase.

## Project status

Early development. Features and implementation details may change as the app takes shape.

## Getting started

```sh
pnpm install
pnpm dev
```

Open http://localhost:3003. See [Development](docs/DEVELOPMENT.md) for Docker self-hosting, backups, and the full verification suite.

## Documentation

- [Product](docs/product.md) — problem, principles, and MVP experience.
- [Domain](docs/domain.md) — concepts, relationships, and ownership boundaries.
- [Roadmap](docs/roadmap.md) — planned delivery stages and future ideas.
- [Development](docs/DEVELOPMENT.md) — local setup, Docker, and backups.

## Scope

Tenure is a personal employment archive, **not** an HR system or payroll processor. It owns detailed employment records; [Taxbook](https://your-tools.dev/) can use relevant pay data for tax tracking, while Passbook handles financial accounts and statements.
