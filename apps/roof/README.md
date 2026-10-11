# Roof

Roof is a personal, self-hosted record of the properties you live in, rent, or are purchasing — and the documents and events that belong with each place.

The first version supports purchase and construction records, current and past rentals, lease and tenant insurance details, scheduled property visits, and dated history with original documents and photos. SQLite, backups, and file storage use the shared Your Tools data platform. Assets, maintenance scheduling, and vendor comparisons are deferred.

See:

- [`docs/PRODUCT.md`](./docs/PRODUCT.md) — problem and scope
- [`docs/DOMAIN.md`](./docs/DOMAIN.md) — domain concepts and rules
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — phased delivery
- [`AGENTS.md`](./AGENTS.md) — guidance for AI-assisted development
- [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) — local setup and self-hosting

## Run locally

Roof uses Node.js 22, pnpm 10, and a local SQLite database.

```sh
pnpm install
pnpm dev
```

Open http://localhost:3004. Local data is stored under `.data/` and ignored by Git.

From the monorepo root:

```sh
pnpm dev:roof
pnpm check:roof
```

## Contributing

Follow the monorepo workflow in [DEVELOPMENT.md](../../DEVELOPMENT.md). Use fictional data only in examples and fixtures.
