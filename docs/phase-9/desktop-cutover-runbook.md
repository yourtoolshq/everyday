# Passbook — Desktop migration and cutover runbook

Reviewed rehearsal for issue [#72](https://github.com/yourtoolshq/everyday/issues/72).
This document describes how to move from the **existing Docker/Next production
deployment** to the **packaged desktop stack** using verified backups. It does
**not** authorize live production cutover — that requires explicit maintainer
approval after this readiness evidence is accepted.

Related documents:

- [Behavior inventory](./behavior-inventory.md) — parity status
- [Integration runbook](./integration-runbook.md) — foundation gate
- [Release contract](./release-contract.md) — packaging and updates
- [Remote access contract](./remote-access-contract.md) — second-device pairing
- [Passbook Docker cutover](../phase-4/passbook-cutover.md) — in-repo image migration (unchanged)

## Scope and stop conditions

**In scope for rehearsal**

- Disposable data directories only
- Verified backup export from a stopped or read-only source
- Restore into a fresh desktop data directory
- Post-restore record and document verification

**Stop immediately if**

- Production volumes (`passbook-data`, `passbook-backups`) are mounted
- Both Docker and desktop hosts would write the same `DATA_DIR`
- Backup verification fails before restore
- Health stays `blocked` or `maintenance` after restore
- Document digests or account counts differ from the source export

**Out of scope**

- Deleting production volumes or source documents
- Publishing installers to end users
- Retiring the Docker deployment without maintainer sign-off

## Architecture after cutover

| Role           | Production today       | Desktop target                               |
| -------------- | ---------------------- | -------------------------------------------- |
| Data owner     | Next container         | Bundled `passbook-host.cjs`                  |
| UI             | Next App Router        | Vite client in Electron or browser           |
| Data directory | Docker volume `/data`  | `{userData}/data/`                           |
| Backups        | `passbook-backups` vol | `{userData}/data/backups/`                   |
| Second device  | Traefik URL            | Pairing + bearer token (see remote contract) |

## Prerequisites

- Passbook Linux AppImage built from the release commit:
  `pnpm package:passbook:linux`
- `yt-data` available on the source system (inside the Docker container or host checkout)
- A verified `.ytbackup` export of the production data
- A disposable destination path for desktop data (never production `userData` on first rehearsal)

## 1. Identify source and destination

Record before any writer shutdown:

```text
source_deployment=docker|desktop-host
source_data_dir=/path/to/source/data
source_backup_dir=/path/to/source/backups
destination_data_dir=/path/to/disposable/desktop-data
destination_backup_dir=/path/to/disposable/desktop-data/backups
release_version=<git short sha or package version>
```

For Docker source:

```bash
docker inspect <passbook-container> --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'
```

Confirm exactly one application writer will touch `source_data_dir` during export.

## 2. Export a verified backup (source writer may run)

From the running Docker container:

```bash
docker compose exec app yt-data backup
docker compose exec app yt-data verify <backup-id>
docker compose exec app yt-data list
```

Or from a checkout against a disposable copy of production data:

```bash
DATA_DIR="$source_data_dir" BACKUP_DIR="$source_backup_dir" \
  node apps/passbook/node_modules/@yourtoolshq/data/dist/yt-data.cjs \
  --app passbook --migrations drizzle backup
```

**Stop condition:** do not proceed unless the backup is marked `verified`.

## 3. Shut down the source writer

```bash
# Docker
docker compose down   # never use -v

# Desktop host
# Quit Passbook desktop or stop the supervised host process
```

Verify no process holds the database:

```bash
# Expect no container using the volume
docker ps --filter volume=passbook-data
```

**Stop condition:** if any writer is still running against `source_data_dir`, stop here.

## 4. Restore into the desktop destination

Use a **fresh** destination directory. The desktop host must not start until
restore completes.

```bash
rm -rf "$destination_data_dir"
mkdir -p "$destination_data_dir" "$destination_backup_dir"

DATA_DIR="$destination_data_dir" BACKUP_DIR="$source_backup_dir" \
  node apps/passbook/node_modules/@yourtoolshq/data/dist/yt-data.cjs \
  --app passbook --migrations drizzle restore <backup-id> --direct
```

Copy the backup archive directory if the restore target is on another machine.

## 5. Start the desktop stack against the destination only

Point the desktop install at the restored data (default: Electron `userData/data`).

Manual smoke without packaging:

```bash
cd apps/passbook/client && pnpm build
cd apps/passbook/host
DATA_DIR="$destination_data_dir" BACKUP_DIR="$destination_backup_dir" pnpm dev

# Separate terminal
cd apps/passbook/desktop
PASSBOOK_DESKTOP_USE_DIST=1 \
DATA_DIR="$destination_data_dir" BACKUP_DIR="$destination_backup_dir" pnpm dev
```

Packaged AppImage:

```bash
./passbook-<version>-linux-x86_64.AppImage
# Uses OS userData; copy restored data there only after rehearsal approval
```

## 6. Post-restore verification checklist

| Check         | Command / action                               | Pass criteria                          |
| ------------- | ---------------------------------------------- | -------------------------------------- |
| Health        | `curl -fsS http://127.0.0.1:<port>/api/health` | `"status":"ok"`, `"state":"ready"`     |
| Household     | tRPC `setup.state`                             | `initialized: true`                    |
| Counts        | tRPC `overview.summary`                        | Match pre-export counts                |
| Statements    | tRPC `documents.statementDocumentsByAccount`   | Period map unchanged                   |
| Documents     | tRPC `documents.overview`                      | Same document count                    |
| File bytes    | `GET /api/data/files/<fileId>`                 | SHA-256 matches export evidence        |
| Relationships | Open several accounts and institutions         | Owners, periods, links intact          |
| Second device | Pair from `/pair` on remote browser            | Authenticated read after pairing       |
| Restart       | Quit and relaunch desktop                      | Data persists                          |
| Single writer | Inspect running processes                      | Only desktop host uses destination dir |

Automated rehearsal (fixture-based, CI-safe):

```bash
pnpm migration-rehearsal:gate
```

This script seeds the `previous-release` fixture, migrates on the bundled host,
exports a verified backup, **stops the source host**, restores into a disposable
desktop directory, and compares record counts plus document digests.

## 7. Rollback

If verification fails on the desktop destination:

1. **Do not** delete the source data or the verified backup.
2. Keep the failed destination directory for analysis (`PASSBOOK_KEEP_GATE_DATA=1` in automated runs).
3. Restart the original Docker deployment from the unchanged source volume.
4. Record failure reason, health payload, and any digest mismatches in the issue handoff.

Rollback of the **source** Docker deployment itself follows
[passbook-cutover.md](../phase-4/passbook-cutover.md) § Roll back.

## 8. Update rehearsal (packaged)

After a successful data rehearsal:

```bash
pnpm release:gate
```

Proves backup checkpoint, versioned host restart, and recovery from a failed
update attempt on disposable data.

Manual AppImage update rehearsal:

1. Install version A to a test profile.
2. Create household data and a verified backup.
3. Install version B over A.
4. Confirm data survives and `GET /api/data/status` reports version B.
5. Simulate failure and restore from the pre-update backup id recorded in
   `{dataDir}/.update/intent.json`.

## 9. What remains for authorized production cutover

- Maintainer approval using this runbook and [behavior-inventory.md](./behavior-inventory.md)
- Closing unresolved SPA route gaps or accepting them as known limitations
- Signing and update-feed publication (if auto-update is required)
- Communication plan for Traefik/Docker decommission
- 30-day retention of pre-cutover volume tarball (see Docker cutover checklist)

## Evidence template (PR / issue handoff)

```text
Fixture: previous-release | production backup <id> (disposable copy only)
Source: <path or container>
Destination: <path>
Before counts: members=N institutions=N accounts=N documents=N
After counts:  members=N institutions=N accounts=N documents=N
Document digests: <fileId>=<sha256 prefix> …
Checks: check:passbook ✓ foundation:gate ✓ release:gate ✓ remote-access:gate ✓ migration-rehearsal:gate ✓
Packaging: package:passbook:linux <artifact name> (manual)
Limitations: <SPA routes, signing, OS targets>
Production cutover: NOT AUTHORIZED — readiness only
```
