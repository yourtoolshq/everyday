# Development and self-hosting

Passbook uses Node.js 22 and pnpm 10.

## Local development

```sh
pnpm install
pnpm dev
```

Open http://localhost:3002. Local SQLite data and managed documents are stored under `.data/` and ignored by Git.

Optional environment variables:

```sh
DATABASE_URL=file:./.data/passbook.db
DOCUMENTS_DIR=./.data/documents
PORT=3002
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

The service binds to `127.0.0.1:3002` by default and stores its SQLite file and managed documents in the `passbook-data` Docker volume.

Set `PASSBOOK_PORT` when port 3002 is already in use:

```sh
PASSBOOK_PORT=3200 docker compose up --build -d
```

## Traefik

Passbook joins the external `web` Docker network and registers with Traefik at `passbook.tools.local`.

Add a hosts entry if needed:

```sh
echo "127.0.0.1 passbook.tools.local" | sudo tee -a /etc/hosts
```

Then open https://passbook.tools.local. Traefik serves a locally-trusted mkcert
wildcard certificate for `*.tools.local` (configured in dotfiles).

## Documents and backups

Account documents are managed copies under `DOCUMENTS_DIR` (default `.data/documents`, or `/data/documents` in Docker). Uploads are limited to one PDF, JPEG, PNG, WebP, or HEIC file at a time and 25 MiB per file.

A complete backup must include both the SQLite database and the entire documents directory. Restore both from the same backup point so document metadata and managed files remain consistent.

```sh
pnpm backup -- /path/to/passbook-backup.db
pnpm restore -- /path/to/passbook-backup.db
```

After changing the schema, generate and commit a migration with `pnpm db:generate`. See [`ENGINEERING.md`](ENGINEERING.md) for the full migration workflow and rules.
