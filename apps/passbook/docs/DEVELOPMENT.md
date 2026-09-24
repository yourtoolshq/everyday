# Development and self-hosting

Passbook uses Node.js 22 and pnpm 10.

## Local development

```sh
pnpm install
pnpm dev
```

Open http://localhost:3002. The SQLite database (`DATA_DIR/passbook.db`) and managed documents are stored under `.data/` and ignored by Git.

Optional environment variables:

```sh
DATA_DIR=./.data
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

Add hosts entries if needed (`/etc/hosts` does not support wildcards):

```sh
echo "127.0.0.1 taxbook.tools.local tenure.tools.local passbook.tools.local tools.local" | sudo tee -a /etc/hosts
```

Then open https://passbook.tools.local. Traefik serves a locally-trusted mkcert
wildcard certificate for `*.tools.local` (configured in dotfiles).

## Documents and backups

Account documents are managed copies under `DATA_DIR/documents` (`DATA_DIR` defaults to `.data`, or `/data` in Docker). Uploads accept one PDF, image (JPEG, PNG, WebP, HEIC), EML, or audio (MP3, M4A, WAV, OGG) file at a time, up to 25 MB.

A backup is one `.ytbackup` archive holding the database and every document it references, verified after it is written. Backups go to `BACKUP_DIR`, which defaults to `DATA_DIR/backups`. `pnpm data` runs the [`yt-data`](../../../docs/phase-4/data-platform.md#command-line) CLI against a running `pnpm dev` server, or against `.data` directly when the server is stopped:

```sh
pnpm data backup
pnpm data list
pnpm data restore <backup id>
```

In Docker, backups go to `/backups`, the `passbook-backups` volume. Set `PASSBOOK_BACKUP_DIR` to a host path to keep them outside Docker, and `APP_VERSION` to record the version in each backup:

```sh
PASSBOOK_BACKUP_DIR=/srv/backups/passbook APP_VERSION=1.4.0 docker compose up --build -d
docker compose exec app yt-data backup
```

The [recovery runbook](../../../docs/phase-4/data-platform.md#recovery-runbook) covers restoring in Docker and moving data to another computer.

After changing the schema, generate and commit a migration with `pnpm db:generate`. See [`ENGINEERING.md`](ENGINEERING.md) for the full migration workflow and rules.
