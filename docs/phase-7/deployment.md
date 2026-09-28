# Phase 7 — Unified deployment plan

Planning inventory: September 2026. Implementation recorded against this
contract. [ROADMAP.md](../../ROADMAP.md#phase-7--unified-deployment) owns the
goal and completion criteria. This plan describes repository work and the proof
needed before changing any running installation. It does not itself perform a
production deployment.


## Outcome and boundary

Make each of the four apps straightforward to build, start, inspect, and recover
using the same documented container conventions while keeping its own image,
Compose project, database, files, and backups. A maintainer should be able to
work on one app without starting or changing the other three.

Keep the existing host deployment route. The host's Nix-managed configuration
owns the pinned source revision, service lifecycle, upgrade invocation, and
routing; its machine-specific files and secrets stay outside this repository.
The app Compose files already attach to the external `web` network and carry
Traefik labels for the existing `*.tools.local` hosts. Those labels are an
integration with the current host setup, not a new routing project. Do not add
`*.localhost` domains, a second proxy, or a suite-wide gateway.

Phase 4 owns backup, restore, migration safety, and the original data cutovers.
Phase 8 owns release tags, published images, and update/rollback orchestration.
This phase may document and exercise their deployment handoffs, but should not
redesign either system.

## Deployment matrix

Effective configuration verified with
`docker compose -f apps/<app>/docker-compose.yml config` (no published
application ports; volumes keep their fixed production names).

| | Taxbook | First Aid | Passbook | Tenure |
| --- | --- | --- | --- | --- |
| Build command | `pnpm docker:build:taxbook` | `pnpm docker:build:firstaid` | `pnpm docker:build:passbook` | `pnpm docker:build:tenure` |
| Dockerfile | `apps/taxbook/Dockerfile` | `apps/firstaid/Dockerfile` | `apps/passbook/Dockerfile` | `apps/tenure/Dockerfile` |
| Build context | repository root | repository root | repository root | repository root |
| Compose project dir | `apps/taxbook` | `apps/firstaid` | `apps/passbook` | `apps/tenure` |
| Internal port | `3000` | `3000` | `3000` | `3000` |
| Health endpoint | `/api/health` | `/api/health` | `/api/health` | `/api/health` |
| Data mount | `taxbook-data` → `/data` | `firstaid-data` → `/data` | `passbook-data` → `/data` | `tenure-data` → `/data` |
| Backup mount | `${TAXBOOK_BACKUP_DIR:-taxbook-backups}` → `/backups` | `${FIRSTAID_BACKUP_DIR:-firstaid-backups}` → `/backups` | `${PASSBOOK_BACKUP_DIR:-passbook-backups}` → `/backups` | `${TENURE_BACKUP_DIR:-tenure-backups}` → `/backups` |
| Required network | external `web` | external `web` | external `web` | external `web` |
| Restart policy | `unless-stopped` | `unless-stopped` | `unless-stopped` | `unless-stopped` |
| Hostname | `taxbook.tools.local` | `firstaid.tools.local` | `passbook.tools.local` | `tenure.tools.local` |
| Published host port | none | none | none | none |
| Dev port (not Compose) | `3000` | `3001` | `3002` | `3003` |

Common runtime environment in Compose: `DATA_DIR=/data`, `BACKUP_DIR=/backups`,
`NODE_ENV=production`. Build-time `APP_VERSION` is passed through when set.
Root `.dockerignore` is the build ignore file (images build from the repository
root). Entrypoints create `/data` and `/data/documents`, ensure
`${BACKUP_DIR}` exists when set, `chown` those paths for `nextjs`, and drop
privileges with `su-exec` before `node server.js`.

### Intentional differences

| Difference | Why it remains |
| --- | --- |
| Separate Dockerfile, Compose file, image name, and volume names per app | Independent deployables; never couple lifecycle or data |
| First Aid image omits `public/` | App has no `public/` directory |
| Taxbook / Passbook / Tenure copy `public/` | Favicon and static assets required at runtime |
| Each app copies its own `drizzle/` and `scripts/` | Migrations and `yt-data` stay with the owning app |
| Optional `*_BACKUP_DIR` host path | Operator may keep backups outside the named Docker volume |
| Traefik labels and `*.tools.local` hostnames | Existing Nix/Traefik host route; not a new routing scheme |

## Deployment contract

- **Independent app units:** Each app keeps its own Dockerfile, Compose file,
  image, named data volume, named backup volume, and health endpoint. A shared
  template or script is justified only if it reduces demonstrated maintenance
  work without hiding app-specific paths or coupling deployments.
- **Data paths:** `/data` holds that app's SQLite database and managed
  documents. `/backups` is separate; an explicit app-specific backup-directory
  override may use a host path. Preserve existing volume names and data when
  editing Compose. Never use `docker compose down -v` on an installation
  containing records.
- **Exposure:** Production Compose publishes no app port. The existing host
  route attaches the app to the external `web` network and serves its current
  `*.tools.local` name. Since app routes are unauthenticated, access must
  remain on a trusted local or private network. Development servers retain
  ports 3000–3003 and isolated `.data` directories.
- **Configuration:** Keep required values documented per app. Use build-time
  `APP_VERSION` consistently where supported, and do not bake host secrets or
  local data into images. A missing external network should fail clearly rather
  than silently opening a host port.
- **Health and restart:** `/api/health` is the container readiness signal;
  check both a normal ready state and the Phase 4 maintenance/blocked behavior
  where applicable. Restarting the container must retain data and backups. A
  healthy process is not, by itself, proof that documents or backups survived.
- **Host control:** The Nix-managed deployment remains the source of truth for
  startup and upgrades. Keep the reviewed production revision pinned. Build and
  verified backup must succeed before replacement, as required by
  [Phase 4](../phase-4/data-platform.md#local-production-and-development).

## Validation override

Each app ships `docker-compose.validation.yml` beside its production Compose
file. The override:

- Clears Traefik labels so validation does not register on the host route
- Replaces the external `web` network with a private disposable network name
- Renames data and backup volumes to `yt-validation-<app>-*` names

Never mount `taxbook-data`, `firstaid-data`, `passbook-data`, `tenure-data`, or
their production backup volumes into a validation run. Inspect the rendered
configuration before `up`:

```bash
cd apps/taxbook
docker compose -p yt-validation-taxbook \
  -f docker-compose.yml -f docker-compose.validation.yml config
```

Confirm volume names are `yt-validation-*`, the network is not the shared `web`
external network, labels are empty, and no `ports:` mapping appears. Then:

```bash
docker compose -p yt-validation-taxbook \
  -f docker-compose.yml -f docker-compose.validation.yml up -d --build
```

Exercise inside the container network (no host port publish):

```bash
docker compose -p yt-validation-taxbook \
  -f docker-compose.yml -f docker-compose.validation.yml \
  exec -T app wget -q -O- http://127.0.0.1:3000/api/health
docker compose -p yt-validation-taxbook \
  -f docker-compose.yml -f docker-compose.validation.yml \
  exec -T app yt-data backup
docker compose -p yt-validation-taxbook \
  -f docker-compose.yml -f docker-compose.validation.yml \
  exec -T app yt-data list
docker compose -p yt-validation-taxbook \
  -f docker-compose.yml -f docker-compose.validation.yml restart app
# re-check health and that /data and /backups still contain prior writes
```

Tear down disposable resources only:

```bash
docker compose -p yt-validation-taxbook \
  -f docker-compose.yml -f docker-compose.validation.yml down -v
```

Repeat with `firstaid`, `passbook`, and `tenure` project names. Run one app at a
time; a validation project must not touch another app's volumes.

## Host handoff (Nix-managed)

Machine-specific service files and secrets stay outside this repository (for
example nix-darwin / Arion in the host configuration). This repository supplies
the Compose contract and images; the host manager owns production lifecycle.

Expected upgrade sequence on the data-owning computer:

1. Pin or advance the reviewed source revision in the host configuration (for a
   flake-managed checkout, something like `nix flake update everyday` then a
   host rebuild applies the new pin — a routine rebuild must not silently
   advance the app pin).
2. Build the candidate image from that revision before touching the running
   container.
3. Ask the running app for a verified backup (`yt-data backup` / platform
   backup path). If build or backup fails, leave the current container running.
4. Replace the container only after both succeed; wait for `/api/health` and
   confirm backup listing and representative data access.
5. If health is blocked or the container loops, follow the
   [Phase 4 recovery runbook](../phase-4/data-platform.md#recovery-runbook)
   and the app's cutover notes under `docs/phase-4/`.

Review this procedure against the live host configuration before applying any
production change. Do not treat a repository config change as validated by a
production deployment.

Historic cutover checklists (Taxbook, First Aid, Passbook, Tenure) remain under
`docs/phase-4/` and describe the original data moves; they are not the routine
upgrade path.

## Implementation order

| Order | Work | Smallest reviewable result | Proof and stop point |
| --- | --- | --- | --- |
| 1 | Record the contract | Deployment matrix above; intentional differences listed | `docker compose config` for each app agrees with the matrix; no new hostname or published application port |
| 2 | Align image and startup behavior | Shared entrypoint backup-dir handling; root `.dockerignore` only | Build each affected image; run with disposable volumes; non-root healthy process |
| 3 | Exercise deployment isolation | Per-app `docker-compose.validation.yml` | Health, backups, restart persistence, no host ports, no production volumes |
| 4 | Reconcile operator docs | Root + app development docs match Compose | Maintainer can follow one app's docs without another app's file |
| 5 | Confirm the host handoff | Documented sequence referring to host config | Owner reviews before any live change |

Tracking issue: [#54](https://github.com/yourtoolshq/everyday/issues/54).

## Validation and completion

Run `pnpm check:<app>` for every changed app and `pnpm check` for platform
docs/config. Validate each changed Compose file with `docker compose config`
and each changed image with its `pnpm docker:build:<app>` command. Use only
fictional data and a validation override with disposable project, network, and
volume names for container exercises; inspect the rendered configuration before
`up`. Verify `/api/health`, non-root writes to `/data` and `/backups`, backup
creation/listing, restart persistence, and no published application port.

Phase 7 is complete when all four app deployment contracts are documented and
match their effective Compose/image behavior; each app can be built, started,
checked, and restarted independently on disposable data; the existing Nix host
route has a clear, reviewed handoff; and the production volume and
private-network boundaries remain intact. Record any remaining app-specific
differences as intentional. Do not use a production deployment as the first
validation of a configuration change.
