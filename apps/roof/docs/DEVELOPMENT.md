# Development and self-hosting

Roof uses Node.js 22 and pnpm 10.

## Local development

From `apps/roof`:

```sh
pnpm install
pnpm dev
```

Open http://localhost:3004. SQLite data and documents live under `.data/`.

Optional environment variables:

```sh
DATA_DIR=./.data
BACKUP_DIR=./.data/backups
PORT=3004
```

Verification from the monorepo root:

```sh
pnpm check:roof
```

Or from this app:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm migrations:check
pnpm exec playwright install chromium
pnpm test:e2e
```

## Self-hosting with Docker

```sh
docker compose up --build -d
```

Production Compose mounts `roof-data` at `/data` and `roof-backups` at `/backups`, registers `roof.tools.local` with Traefik, and does not publish a host port.

Disposable validation (isolated network and volumes):

```sh
docker compose -p yt-validation-roof \
  -f docker-compose.yml -f docker-compose.validation.yml config
```

Set `ROOF_BACKUP_DIR` to a host path when backups should live outside the named backup volume.

## Traefik

Add hosts if needed:

```sh
echo "127.0.0.1 roof.tools.local" | sudo tee -a /etc/hosts
```

See the platform [Phase 7 deployment contract](../../../docs/phase-7/deployment.md).

## Files and first use

The app starts empty. Add a property, then add history entries or reference documents. Upload one PDF, image (JPEG, PNG, WebP, HEIC), or exported email (.eml) at a time, up to 25 MB. Multiple uploads can be linked to the same visit or history entry. Original files are preserved by the shared data platform.

Date fields use calendar dates. Visit times are local wall-clock times at the property. No notifications or calendar sync are included.
