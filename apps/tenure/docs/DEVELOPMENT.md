# Development and self-hosting

Tenure uses Node.js 22 and pnpm 10.

## Local development

```sh
pnpm install
pnpm dev
```

Open http://localhost:3003. Local SQLite data and managed documents are stored under `.data/` and ignored by Git.

Optional environment variables:

```sh
DATABASE_URL=file:./.data/tenure.db
DOCUMENTS_DIR=./.data/documents
PORT=3003
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

## Self-hosting with Docker

```sh
docker compose up --build -d
```

The service binds to `127.0.0.1:3003` by default and stores its SQLite file and managed documents in the `tenure-data` Docker volume.

Set `TENURE_PORT` when port 3003 is already in use:

```sh
TENURE_PORT=3200 docker compose up --build -d
```

## Traefik

Tenure joins the external `web` Docker network and registers with Traefik at `tenure.tools.local`.

Add hosts entries if needed (`/etc/hosts` does not support wildcards):

```sh
echo "127.0.0.1 taxbook.tools.local tenure.tools.local passbook.tools.local tools.local" | sudo tee -a /etc/hosts
```

Then open https://tenure.tools.local. Traefik serves a locally-trusted mkcert
wildcard certificate for `*.tools.local` (configured in dotfiles).

## Documents and backups

Employment documents are managed copies under `DOCUMENTS_DIR` (default `.data/documents`, or `/data/documents` in Docker). Uploads are limited to one PDF, JPEG, PNG, WebP, HEIC, or EML file at a time and 25 MiB per file.

A complete backup must include both the SQLite database and the entire documents directory. Restore both from the same backup point so document metadata and managed files remain consistent.

```sh
pnpm backup -- /path/to/tenure-backup.db
pnpm restore -- /path/to/tenure-backup.db
```

After changing the schema, generate and commit a migration with `pnpm db:generate`.
