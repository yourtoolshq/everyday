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

Production Compose publishes no host port. It listens on port 3000 inside the
external `web` network and Traefik serves <https://passbook.tools.local>.
Compose mounts the named `passbook-data` volume at `/data` and the separate
`passbook-backups` volume at `/backups`. Development stays on port 3002 with
`pnpm dev` and `DATA_DIR=./.data`. Never mount `passbook-data` or
`passbook-backups` into a development or test process.

```sh
docker compose build
docker compose up -d
```

The Compose file expects an existing external Docker network named `web`. The
app sets `traefik.docker.network=web` and does not publish `3000` to the host.

Set `PASSBOOK_BACKUP_DIR` to a host directory when backups should live outside
the `passbook-backups` volume:

```sh
PASSBOOK_BACKUP_DIR=/path/to/backups/passbook docker compose up --build -d
```

The host manager builds the candidate image, then asks the running app for a
verified backup. If the build or the backup fails, it leaves the running
container in place. Machine-specific service files and secrets stay outside
this repository. See the platform
[Phase 7 deployment contract](../../../docs/phase-7/deployment.md).

## Traefik

Passbook joins the external `web` Docker network and registers with Traefik at
`passbook.tools.local`.

Add hosts entries if needed (`/etc/hosts` does not support wildcards):

```sh
echo "127.0.0.1 taxbook.tools.local tenure.tools.local passbook.tools.local firstaid.tools.local tools.local" | sudo tee -a /etc/hosts
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

In Docker, backups go to `/backups` (the `passbook-backups` volume unless
`PASSBOOK_BACKUP_DIR` overrides it). Set `APP_VERSION` when building to record
the version in each backup:

```sh
APP_VERSION=1.4.0 docker compose up --build -d
docker compose exec app yt-data backup
```

The [recovery runbook](../../../docs/phase-4/data-platform.md#recovery-runbook)
covers restoring in Docker and moving data to another computer.

After changing the schema, generate and commit a migration with `pnpm db:generate`. See [`ENGINEERING.md`](ENGINEERING.md) for the full migration workflow and rules.
