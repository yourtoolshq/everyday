# Development and releases

## Local development

Tax Book uses pnpm and Node.js 22 or newer. The platform stores local data under `.data` by default:

```sh
cp .env.example .env
command pnpm install
command pnpm dev
```

Open <http://localhost:3000>. The development server keeps port 3000 and reads `DATA_DIR=./.data`; database migrations run during platform boot. Set `DATA_DIR` to another isolated directory when you need a separate local dataset. Tests use `.data/test`, and Playwright uses `.data/e2e`. Neither development nor tests mount production volumes.

Set `BACKUP_DIR` only when local backups should live outside `DATA_DIR`. When omitted, backups are stored under `DATA_DIR/backups`.

## Data and backups

Tax Book's database is `<DATA_DIR>/taxbook.db`; uploaded PDFs and images are under `<DATA_DIR>/documents/`. The app takes verified scheduled backups daily at 02:00 and retains 7 daily, 4 weekly, and 12 monthly backups.

Use the app's **Data & backups** page for backup, restore, and integrity operations. From the app directory, the CLI can list and create backups, and verify or restore one:

```sh
command pnpm data list
command pnpm data backup
command pnpm data verify <backup-id>
command pnpm data restore <backup-id>
```

A successful backup reports `Created backup <id>: verified`. In Docker, use `docker compose exec app yt-data <command>`.

## Self-hosting with Docker

Production Compose has no published host port. It listens on port 3000 inside the external `web` network and Traefik serves <https://taxbook.tools.local>. Compose mounts the named `taxbook-data` volume at `/data` and the separate `taxbook-backups` volume at `/backups`. Set `TAXBOOK_BACKUP_DIR` in the app's `.env` only when a host backup directory should replace the named backup volume.

```sh
docker compose build
docker compose up -d
```

The Compose file expects an existing external Docker network named `web`. The app sets `traefik.docker.network=web` and does not publish `3000` to the host.

Server-side Tenure sync calls use `TENURE_FETCH_BASE_URL` (default `http://tenure.internal:3000`) so the Taxbook container can reach Tenure over the shared `web` network. Browser links and the Tenure base URL in Settings still use `https://tenure.tools.local`. Tenure's Compose file registers the `tenure.internal` network alias for that internal route. Override `TENURE_FETCH_BASE_URL` only when your host uses a different internal Tenure address.

Production and local development can run on the same computer because production uses the named volumes while `pnpm dev` uses `.data`. Do not set local `DATA_DIR` or test configuration to `/data`, `taxbook-data`, or a production volume.

## Host upgrades and cutover

The host manager checks out the reviewed commit and builds its candidate image before asking the running app for a verified backup. It leaves the current container in place if either the build or backup fails. The host manager pins the deployed commit; a routine host rebuild does not advance production automatically.

Machine-specific service files and secrets stay outside this repository. The shared deployment contract, validation override, and host-handoff sequence are in the platform [Phase 7 deployment plan](../../../docs/phase-7/deployment.md). Follow the complete [Taxbook Phase 4 host cutover checklist](../../../docs/phase-4/taxbook-cutover.md) only when moving existing Taxbook data onto this Compose configuration. That historic cutover runs only on the computer that owns the production data, after the change is merged and reviewed.
