# Development and self-hosting

First Aid uses Node.js 22 and pnpm 10.

## Local development

```sh
pnpm install
pnpm dev
```

Open http://localhost:3001. Local SQLite data and managed documents are stored under `.data/` and ignored by Git.

Optional environment variables:

```sh
DATA_DIR=./.data
BACKUP_DIR=./.data/backups
PORT=3001
```

`DATA_DIR` holds `firstaid.db` and `documents/`. Leave `BACKUP_DIR` unset in development and backups are written under `.data/backups`, with a warning that they share the data directory. Set `BACKUP_DIR` to a separate directory when you want that warning gone.

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

Production Compose mounts the named `firstaid-data` volume at `/data` and a separate `firstaid-backups` volume at `/backups`. It does not publish a host port. Traefik serves https://firstaid.tools.local. Development stays on port 3001 with `pnpm dev` and `DATA_DIR=./.data`. Never mount `firstaid-data` or `firstaid-backups` into a development or test process.

Set `FIRSTAID_BACKUP_DIR` to a host directory when backups should live outside the `firstaid-backups` volume:

```sh
FIRSTAID_BACKUP_DIR=/path/to/backups/firstaid docker compose up --build -d
```

The host manager checks out the reviewed commit, builds the candidate image, and asks the running app for a verified backup. If the build or the backup fails, it leaves the running container in place. Machine-specific service files and secrets stay outside this repository.

The host cutover checklist is [firstaid-cutover.md](../../../docs/phase-4/firstaid-cutover.md).

## Traefik

First Aid joins the external `web` Docker network and registers with Traefik at `firstaid.tools.local`.

Add hosts entries if needed (`/etc/hosts` does not support wildcards):

```sh
echo "127.0.0.1 taxbook.tools.local tenure.tools.local passbook.tools.local firstaid.tools.local tools.local" | sudo tee -a /etc/hosts
```

Then open https://firstaid.tools.local. Traefik serves a locally-trusted mkcert
wildcard certificate for `*.tools.local` (configured in dotfiles).

## Documents and backups

Visit documents are stored under `DATA_DIR/documents` (default `.data/documents`, or `/data/documents` in Docker). Uploads are limited to one PDF, JPEG, PNG, WebP, or HEIC file at a time and 25 MB per file.

Backups are verified archives of the database and the files it references. From the app directory:

```sh
pnpm data backup
pnpm data list
pnpm data restore <backup>
```

Inside the running container the same commands are `yt-data backup`, `yt-data list`, and `yt-data restore <backup>`. The CLI talks to the running app when it is listening, and opens the data directory directly when the app is stopped.

After changing the schema, generate and commit a migration with `pnpm db:generate`, then run `pnpm migrations:check`.
