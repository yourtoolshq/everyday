# Tax Book

Tax Book started from a personal problem I am dealing with this year.

Throughout the year, household tax information ends up spread across payslips, receipts, tax documents, notes, spreadsheets, and things I need to remember later.

By the time tax season arrives, a lot of the work becomes reconstructing what happened.

This app is my attempt to make that easier.

The goal is to keep the important tax information organized throughout the year so filing becomes mostly review, confirmation, and submission.

## What I am trying to track

The initial focus is Canadian personal income tax for my household.

That includes things like:

* income for each household member
* individual paycheques
* gross pay, tax withheld, CPP, EI, and net pay
* expected vs actual vs projected annual income
* deductions, credits, contributions, and other tax-relevant items
* expenses where I need to retain supporting records
* official tax documents such as T4s and RRSP/FHSA slips
* estimated refund or amount owing
* final tax filing information
* refunds or payments
* CRA assessment / Notice of Assessment
* completed tax years that can be confidently referenced later

## Current approach

This is intentionally being built as **personal software first**.

I am not currently trying to make a tax product that handles every Canadian household or every possible tax situation.

The priority is:

1. solve the problem I actually have
2. build the smallest useful workflow
3. start using it
4. improve it based on real usage

That also means avoiding unnecessary complexity early on, such as building a complete tax rules engine, payroll integrations, bank syncing, or tax filing software before they are actually needed.

## YourToolsHQ

This repository is part of **YourToolsHQ**, where I am keeping open-source tools I build to solve problems in my own life.

AI-assisted development makes it much easier to turn smaller personal problems into useful software without needing to justify them as full products.

The code is open source so others can inspect it, adapt it, or reuse ideas from it.

I may also share parts of the process through blog posts, YouTube videos, or live streams when time allows, but building and using the tool comes first.

## Project docs

* [`PRODUCT.md`](./docs/product.md) — what the app is trying to solve
* [`DOMAIN.md`](./docs/domain.md) — domain language and relationships
* [`ROADMAP.md`](./docs/roadmap.md) — delivery phases
* [`intentional-exclusions.md`](./docs/intentional-exclusions.md) — features deliberately not built
* [`AGENTS.md`](./AGENTS.md) — guidance for AI agents working in this repository

## Contributing

Ideas and bug reports are welcome.

* For feature ideas, questions, or bugs, create an **Issue**.
* For code or documentation contributions, open a **Pull Request**.

Because this project is primarily driven by a real personal workflow, proposed features may be kept small, deferred, or declined if they push the app away from that focus.

## Run the local production app

Tax Book runs as a private local container and is available only from the same
computer at <http://localhost:3000>.

    docker compose up --build -d

The SQLite database is stored in the persistent Docker volume
`taxbook-data`. Stopping, rebuilding, or replacing the app container does not
remove it.

### Back up and restore

Create a consistent backup while the app is running:

    pnpm backup -- /path/to/taxbook-backup.db

Restore a backup (this replaces the current database and restarts the app):

    pnpm restore -- /path/to/taxbook-backup.db

### Upgrade from main

    pnpm backup -- /path/to/pre-upgrade-backup.db
    git pull --ff-only origin main
    docker compose up --build -d
    docker compose ps

Committed database migrations run before the new application starts. See
[`docs/development.md`](./docs/development.md) for development and release
conventions.
