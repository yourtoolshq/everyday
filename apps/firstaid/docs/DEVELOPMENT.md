# Development and self-hosting

First Aid uses Node.js 22 and pnpm 10.

## Local development

```sh
pnpm install
pnpm dev
```

Open <http://localhost:3001>. Local SQLite data and managed visit documents are
stored under `.data/` and ignored by Git. No environment file is required for
the default local setup. Set `DATABASE_URL` to override the SQLite location,
`DOCUMENTS_DIR` to override managed-document storage, and `PORT` to override
the development port:

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

The service binds to `127.0.0.1:3001` by default and stores its SQLite file and
managed documents in the `firstaid-data` Docker volume. Put an authenticated
reverse proxy in front of the application before exposing it beyond the local
machine.

Set `FIRSTAID_PORT` when port 3001 is already in use, for example:

```sh
FIRSTAID_PORT=3200 docker compose up --build -d
```

## Documents and backups

Visit documents are managed copies under `DOCUMENTS_DIR` (default
`.data/documents`, or `/data/documents` in Docker). Uploads are limited to one
PDF, JPEG, PNG, WebP, or HEIC file at a time and 25 MiB per file. First Aid
validates the file signature rather than trusting the filename extension.

A complete backup must include both the SQLite database and the entire
documents directory. Restore both from the same backup point so document
metadata and managed files remain consistent. First Aid does not currently
provide automated backups or encryption at rest.

After changing the schema, generate and commit a migration with
`pnpm db:generate`.
