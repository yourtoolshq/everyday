# Development and self-hosting

First Aid uses Node.js 22 and pnpm 10.

## Local development

```sh
pnpm install
pnpm dev
```

Open <http://localhost:3001>. Local SQLite data is stored under `.data/` and
is ignored by Git. No environment file is required for the default local
setup. Set `DATABASE_URL` to override the SQLite location, and set `PORT` to
override the development port:

```sh
PORT=3002 pnpm dev
```

Run the verification suite with:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

## Self-hosting

Start the containerized application with:

```sh
docker compose up --build -d
```

The service binds to `127.0.0.1:3001` by default and stores its SQLite file in
the `firstaid-data` Docker volume. Put an authenticated reverse proxy in front
of the application before exposing it beyond the local machine.

Set `FIRSTAID_PORT` when port 3001 is already in use, for example:

```sh
FIRSTAID_PORT=3200 docker compose up --build -d
```

No domain tables or migrations exist in the skeleton. When the first workflow
introduces a schema, generate and commit its migration with `pnpm db:generate`.
