# Phase 4 — Data Platform

Design for the shared data layer every Your Tools application adopts: file storage, backup, restore, scheduled backups, integrity checks, storage usage, and version-safe migrations, together with the UI that exposes them. Phase goals and completion criteria live in [ROADMAP.md](../../ROADMAP.md#phase-4--data-durability-and-storage-critical-priority).

An application declares a contract and a file router and wires the files listed under [Wiring](#wiring). Everything else in this document comes with the packages.

## Packages

| Package                | Kind        | Contents                                                                                                                                                                                   |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@yourtoolshq/data`    | server-only | `defineDataPlatform`, file store and file router, `yt_files`/`yt_meta` schema, guarded migration runner, backup/verify/restore, scheduler, integrity, usage, route handlers, `yt-data` CLI |
| `@yourtoolshq/ui`      | client      | Generic shadcn primitives: card, button, table, badge, alert-dialog, dialog, progress, skeleton, sonner                                                                                    |
| `@yourtoolshq/data-ui` | client      | Data screens built from `@yourtoolshq/ui`: `DataSettingsPage`, `DataGate`, `MaintenanceScreen`, `BackupStatusBanner`, `FileDropzone`, `FilePreview`, `FileViewerPage`, upload helpers      |

```
@yourtoolshq/ui  ◄── @yourtoolshq/data-ui ──► (HTTP) /api/data/*  ◄── @yourtoolshq/data
   primitives          data screens                                     server
        ▲                     ▲
        └──── apps ───────────┘
```

`data-ui` talks to the platform only over HTTP, so it has no dependency on an application's tRPC client.

## Application contract

```ts
// src/server/data.ts
export const dataPlatform = defineDataPlatform({
  app: "passbook",
  version: process.env.APP_VERSION,
  dataDir: env.DATA_DIR, // /data in Docker, ./.data in development
  backupDir: env.BACKUP_DIR, // separate mount; falls back to <dataDir>/backups
  db: { schema, migrationsFolder: "drizzle" },
  backups: {
    schedule: "daily@02:00",
    retention: { daily: 7, weekly: 4, monthly: 12 },
  },
  dataMigrations: [],
});
```

```ts
// src/server/db/index.ts
export const db = dataPlatform.db;
```

The platform owns the database connection so it can close and reopen it around a restore.

### Wiring

| File                                   | Content                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `src/instrumentation.ts`               | `await dataPlatform.boot()` in `register()` for the Node.js runtime             |
| `src/app/api/data/[...path]/route.ts`  | `export const { GET, POST } = createDataHandlers(dataPlatform, { fileRouter })` |
| `src/app/(app)/layout.tsx`             | Wrap the shell and the layout's queries in `<DataGate platform={dataPlatform}>` |
| `src/app/(app)/settings/data/page.tsx` | Render `<DataSettingsPage />`                                                   |
| `src/app/files/[fileId]/page.tsx`      | `export { FileViewerPage as default } from "@yourtoolshq/data-ui"`              |

Plus `files: dataPlatform.files` in the tRPC context and the platform readiness middleware on the base procedure.

`DataGate` comes from `@yourtoolshq/data-ui/server`. Pages outside `(app)/` that query the database, such as a setup page, wrap their content in it too.

Tailwind does not scan workspace packages, so `src/styles/globals.css` adds them as sources:

```css
@source "../../../../packages/ui/src";
@source "../../../../packages/data-ui/src";
```

## Files

### Schema

The platform owns file metadata in `yt_files`: `id`, `storage_key`, `original_filename`, `mime_type`, `size_bytes`, `sha256`, `endpoint`, `created_at`. Applications re-export `filesTable` and `platformMetaTable` from their schema, so drizzle-kit generates both tables into the application's own migration history. Domain tables reference a file with a single foreign key:

```ts
fileId: text("file_id").notNull().references(() => filesTable.id),
```

References are discovered with `PRAGMA foreign_key_list`, so integrity checks, usage, and backups need no per-application configuration.

### File router

```ts
// src/server/files.ts
export const fileRouter = createFileRouter({
  statement: file({ types: ["pdf"], maxBytes: "25MB" }),
  accountDocument: file({ types: ["pdf", "image", "eml"], maxBytes: "25MB" }),
  voiceNote: file({ types: ["audio"], maxBytes: "50MB" }),
});
export type AppFileRouter = typeof fileRouter;
```

Type groups: `pdf`, `image` (JPEG, PNG, WebP, HEIC), `eml`, `audio` (MP3, M4A, WAV, OGG). Types are detected from magic bytes, not from the client-supplied MIME type.

### Upload, claim, and remove

```
 pick file ─► FileDropzone ─► POST /api/data/upload/:endpoint ─► .staging/<token>   (reaped after 24 h)
                               ◄── { token, name, size }
 submit form ─► app tRPC mutation { ..., file: token }
                 withFiles(db, async (tx, files) => {
                   const f = await files.claim(token)       // yt_files row + move into documents/
                   await tx.insert(table).values({ ..., fileId: f.id })
                 })
                 commit ─► file is permanent        throw ─► file returns to staging, row rolled back
```

A file becomes permanent only in the transaction that inserts the row referencing it. `files.remove(fileId)` inside `withFiles` deletes the row and unlinks the file after commit; a running backup holds the unlink until its archive is written.

```ts
// src/lib/uploads.ts
export const { FileDropzone, useUpload } = createUploadHelpers<AppFileRouter>();
```

```tsx
<FileDropzone endpoint="statement" onUploaded={setFile} />
```

```ts
create: publicProcedure
  .input(z.object({ accountId: z.string().uuid(), file: fileToken("statement") }))
  .mutation(({ ctx, input }) =>
    ctx.files.withFiles(ctx.db, async (tx, files) => {
      const f = await files.claim(input.file);
      return tx.insert(statements).values({ accountId: input.accountId, fileId: f.id }).returning();
    }),
  ),
```

### Retrieval and preview

`FilePreview` opens every file in a new tab:

| Type              | New tab                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| PDF, image, audio | `/api/data/files/:id`, served inline for the browser's native viewer                                 |
| EML               | `/files/:id`, rendering `EmlViewer`: headers, sanitized HTML body in a sandboxed iframe, attachments |
| Anything else     | Download                                                                                             |

`fileUrl(id, { download: true })` returns a download link. Server code uses `ctx.files.read(id)` and `ctx.files.stream(id)`. Responses send `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, and an RFC 5987 `Content-Disposition`.

## HTTP surface

All served by the catch-all route.

| Route                             | Purpose                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `POST /api/data/upload/:endpoint` | Validate and stage an upload; returns a token                           |
| `GET /api/data/files/:id`         | Stream a file (`?download=1` for attachment disposition)                |
| `GET /api/data/files/:id/eml`     | Parsed EML for the viewer                                               |
| `GET /api/data/backups/:id`       | Stream a backup archive                                                 |
| `POST /api/data/backups/upload`   | Upload an archive to restore                                            |
| `GET /api/data/status`            | Platform state; see [Platform state](#boot-sequence-and-platform-state) |
| `/api/data/trpc/*`                | Platform router: `backups`, `usage`, `integrity`, `schedule`, `health`  |

The `backups` router has `list`, `create`, `verify`, and `restore`; `verify` and `restore` take a backup id in the backup directory. The `integrity` router has `scan`, `last`, `quarantine`, and `purge`; see [Integrity](#integrity). Operations that need `ready` data answer 409 while the platform is upgrading, restoring, or blocked. The platform router accepts POST requests only as `application/json` and answers 415 otherwise. Applications keep their own router at `/api/trpc` for domain procedures.

## Storage layout

```
<dataDir>/<app>.db
<dataDir>/documents/<uuid>.<ext>
<dataDir>/documents/.staging/    uploads awaiting claim
<dataDir>/documents/.orphans/    quarantined unreferenced files
<dataDir>/restore.inprogress     marker for a restore in progress
<dataDir>/.restore/              extracted archive and the data it replaces, during a restore
<backupDir>/<app>-<UTC timestamp>.ytbackup
<backupDir>/<app>-<UTC timestamp>.ytbackup.json   manifest and verification result
```

`BACKUP_DIR` is a separate mount (host path or NAS) so backups survive loss of the data volume. Without it, backups are written to `<dataDir>/backups` and the data page, banner, and health report show a warning.

## Boot sequence and platform state

State is one of `ready`, `upgrading`, `restoring`, `blocked`.

```
 awaited in register(), before the server accepts requests
  1. layout         ensure data, documents, staging, orphans, and backup directories
  2. crash check    restore.inprogress marker → finish or roll back the restore
  3. version guard  compare applied migration hashes with the application journal
                      database has unknown migrations → blocked(downgrade)
                      an applied hash differs         → blocked(edited-migration)
                      nothing pending                 → step 6
 server listening; state = upgrading
  4. snapshot       verified pre-migration backup (skipped for an empty database)
  5. migrate        one transaction, on a connection with foreign_keys=OFF:
                      pending migrations → foreign_key_check → dataMigrations
                      → record app version, platform version, and time in yt_meta
                      failure → transaction rolled back → blocked(migration-failed)
  6. ready          start scheduler; reap .staging older than 24 h
```

`boot()` resolves after step 3. Steps 4 and 5 run in the background, so the status endpoint and the gates answer while they do; `settled()` resolves once they finish and returns the state. Local libsql runs each statement synchronously, and the runner yields to the event loop between statements, so one long statement holds requests until it completes.

`GET /api/data/status` returns the state with the application name and version:

```text
{ "app": "passbook", "version": "1.4.0", "state": "upgrading", "step": "migrate", "migrations": ["0011_x"] }
{ "app": "passbook", "version": "1.4.0", "state": "blocked", "reason": "downgrade", "message": "…",
  "restorableBackups": [{ "id": "…", "createdAt": "…", "appVersion": "1.5.0", "trigger": "pre-migration" }] }
```

`step` is `backup` or `migrate`. `restorableBackups` lists verified backups whose migrations are all in the running version's journal; it is present while the version guard blocks the database. A `migration-failed` block has none: a restored backup is upgraded by the same migrations.

The version guard reads the rows drizzle keeps in `__drizzle_migrations`, matches each to the journal entry with the same timestamp, and compares their hashes. The runner writes the same rows drizzle does, so `drizzle-kit migrate` works on a database the platform migrated.

Migrations run with foreign keys off because drizzle-kit's SQLite table rebuilds (`CREATE __new_x`, `DROP x`, `RENAME`) set `PRAGMA foreign_keys=OFF` inside the migration transaction, where SQLite ignores it; with enforcement on, `DROP x` cascades to child rows. Every other connection enforces foreign keys, which is the libsql default.

### Gates

| Layer  | Behavior when not `ready`                                                                                                                                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages  | `DataGate` renders `MaintenanceScreen` (progress, or the blocked reason with compatible backups to restore); reloads on `ready`. It guards only its own children, so database queries go inside it                                                 |
| tRPC   | Readiness middleware throws `SERVICE_UNAVAILABLE`. This is the guard that matters: Next.js renders layouts and pages in parallel                                                                                                                   |
| Files  | `GET /api/data/files/:id` and `POST /api/data/upload/:endpoint` answer 503; a migration may be changing `yt_files`                                                                                                                                 |
| Health | `/api/health` answers 200 with `status: "maintenance"` and the state, and skips the database check. Traefik routes only to healthy containers, and the maintenance screen has to stay reachable. When `ready`, a failed database check answers 503 |

The platform router and backup downloads stay available: restoring a backup is the remedy for a blocked database.

## Version guarantees

1. The pre-upgrade state is never lost.
2. Code never runs against a schema it does not recognize.
3. No partially applied migration survives a failure or crash.
4. Structural corruption is detected before the application serves requests.

A migration that transforms data incorrectly still applies; the CI upgrade test and the pre-migration backup cover that case.

| Scenario                               | Outcome                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------ |
| Upgrade succeeds                       | Pre-migration backup kept for 30 days regardless of retention            |
| Migration throws                       | Transaction rolled back; `blocked(migration-failed)` names the migration |
| Process killed mid-migration           | SQLite rolls back the transaction; the next boot retries                 |
| Older version on a newer database      | `blocked(downgrade)` lists backups created by the running version        |
| Applied migration edited               | `blocked(edited-migration)`                                              |
| Restore a backup from an older version | Restore, then the normal upgrade path                                    |
| Restore a backup from a newer version  | Rejected during verification                                             |
| Archive format change                  | `manifest.formatVersion`; every earlier format stays readable            |
| Platform table change                  | Shipped as drizzle schema; the application generates the migration       |

### CI checks

An application's `migrations:check` script runs `yt-data migrations check` against `origin/main` (`--base <ref>` picks another ref). It runs in `pnpm check`, `pnpm check:<app>`, and CI:

- Migrations on `origin/main` keep their file, journal position, and timestamp. Each timestamp is later than the one before it, so a migration generated on an out-of-date branch is generated again on top of `origin/main`.
- Every migration applies, in order, to an empty database.
- A new migration that drops a table, drops a column (including a table rebuild that leaves a column out), or runs `DELETE FROM` starts with the line `-- yt:reviewed-destructive`. Renames are followed, so renaming a table or column needs no marker.

In the application directory, run `pnpm migrations:check` right after `pnpm db:generate` and add any marker then: adding it changes the file's hash, so a development database that already applied the migration reports `blocked(edited-migration)`.

Each application's `src/server/db/upgrade.test.ts` upgrades the previous release's data. Its fixture, `src/server/db/fixtures/previous-release/`, holds `<app>.sql`, a `sqlite3 .dump` of a fictional database, and the `documents/` it references. The test loads the fixture into a temporary data directory and boots the platform on it. It then checks for a verified pre-migration backup, unchanged row counts, `integrity_check`, and `foreign_key_check`. Finally it calls the application's own procedures and reads every file.

When a release ships, refresh the fixture from that release:

1. Load the fixture into a data directory with `sqlite3 <dir>/<app>.db < <app>.sql` and copy `documents/` next to it.
2. Start the released version with `DATA_DIR=<dir>`. It migrates the fixture.
3. Add fictional records for anything the release introduced.
4. Stop it and replace the fixture with `sqlite3 <dir>/<app>.db .dump` and the files in `<dir>/documents/`, leaving out its `.staging`, `.trash`, and `.orphans` folders.

## Backups

### Archive

`<app>-<UTC timestamp>.ytbackup` is a tar file containing `db.sqlite` (from `VACUUM INTO`), every file referenced by `yt_files` in that snapshot, and `manifest.json`, in that order:

```json
{
  "formatVersion": 1,
  "app": "passbook",
  "appVersion": "1.4.0",
  "platformVersion": "0.3.0",
  "createdAt": "2026-09-24T02:00:00Z",
  "trigger": "scheduled",
  "migrations": [{ "tag": "0000_…", "hash": "…" }],
  "rowCounts": { "accounts": 12, "yt_files": 318 },
  "files": [
    { "id": "…", "path": "documents/….pdf", "size": 184223, "sha256": "…" }
  ],
  "missingFiles": [{ "id": "…", "storageKey": "….pdf" }]
}
```

Triggers: `scheduled`, `manual`, `pre-migration`, `pre-restore`. `migrations` lists the snapshot's applied drizzle migrations by hash; `tag` is `null` for a hash the application journal does not contain. `missingFiles` lists `yt_files` rows whose file was not on disk when the backup ran; the backup still succeeds and logs a warning for each.

### Verification

Every backup is verified immediately: extract `db.sqlite`, run `integrity_check` and `foreign_key_check`, compare row counts and `yt_files` rows with the manifest, and re-hash every file. An archive with an entry the manifest does not list, or any entry other than `db.sqlite`, `manifest.json`, and `documents/<storage key>`, fails. The result is written to the `.ytbackup.json` sidecar next to the archive. Only verified backups count toward freshness and retention.

### Scheduling and retention

The scheduler runs in the application process once `boot()` succeeds, when the platform is defined with `backups`. Backups, migrations, restores, and file deletes share one state machine, so they never overlap. `yt-data` defines the platform without `backups`, so it never schedules.

- `schedule` is `daily@HH:MM` in the process's time zone, UTC in the Docker images unless `TZ` is set. The scheduler compares the wall clock every minute, so a host that slept or changed its clock still backs up on its next check.
- On `ready`, a backup runs within two minutes when the newest verified backup is more than a day old.
- A failed backup is logged as an error and retried at the next scheduled time.
- Retention runs after every scheduled backup. Each count keeps the newest backup of that many of the most recent local calendar days, weeks starting Monday, and months that have a backup. Every trigger counts toward retention; pre-migration backups are kept for 30 days regardless. Retention prunes only verified backups and always keeps the newest verified backup.
- Health reports `backup: ok | stale | failing` and `lastVerifiedBackupAt`. Stale means no verified backup within twice the interval. Backup status does not change the HTTP status.

### Command line

`yt-data` is in every application image at `/usr/local/bin/yt-data` and runs as the application user. In development it runs as `pnpm data <command>` from the application directory.

| Command            | Effect                                                |
| ------------------ | ----------------------------------------------------- |
| `list`             | Backups, newest first, with trigger, size, and status |
| `backup`           | Take a backup and verify it                           |
| `verify <backup>`  | Verify a backup again                                 |
| `restore <backup>` | Take a `pre-restore` backup, then restore `<backup>`  |

`<backup>` is a backup id or the path of a `.ytbackup` file. When the application answers at `http://127.0.0.1:$PORT`, the command runs inside it, so it never overlaps with the application's own work; the application verifies and restores only archives in `BACKUP_DIR`. When nothing answers, the command opens the data directory itself the way the application does at start, which finishes an interrupted restore and runs pending migrations, taking a pre-migration backup first. When the version guard blocks the database, the command prints the reason and carries on, so `restore` can replace it. It cannot see an application running in another container on the same volume, so stop the application first. `--direct` skips the HTTP check.

A host cron entry such as `docker compose exec -T app yt-data backup` adds backups on top of the schedule.

### Restore

1. Extract the archive into `.restore/incoming` and verify it; reject it if its migrations are not a subset of the application journal.
2. Take a `pre-restore` backup; stop if it does not verify.
3. Pause database work: new work waits, and work already running finishes. Write `restore.inprogress` (`swapping`).
4. Close the connection, move the live database and documents to `.restore/previous`, move the extracted ones into place, reopen, and run `integrity_check`.
5. Apply pending migrations in one transaction when the backup is from an older version. The archive is the pre-migration state, so no further backup is taken.
6. Mark the restore `swapped`, delete `.restore`, and remove the marker. Waiting work continues against the restored data.

A failure in steps 4–5 moves the previous data back. At boot, a `swapping` marker rolls the swap back and a `swapped` marker finishes the cleanup.

The platform state is `restoring` for the whole restore. A restore requested while the platform is `upgrading` or `restoring` is refused, with 409 over HTTP. A successful restore leaves the platform `ready` and starts the scheduler if it was not running; a failed one returns to the state it started from.

## Integrity

The integrity scan covers the whole database and every stored file. It runs on request, only while the platform is `ready`, and queues behind backups and restores:

| Check                   | Finding                                                 | Action                                                                                 |
| ----------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `integrity_check`       | Page or index corruption in any table                   | Restore the newest verified backup                                                     |
| `foreign_key_check`     | Broken relationship in any table                        | Reported with table and row                                                            |
| Migration version guard | Schema mismatch                                         | `blocked` state                                                                        |
| File presence           | `yt_files` row without a file on disk                   | Reported with the referencing record                                                   |
| Checksum                | File content differs from `sha256`                      | Reported; restore the file from a backup. A missing `sha256` is recorded               |
| Unreferenced file       | File on disk without a row, or a row nothing references | Reported; moved to `.orphans/` on request, and deleted from there only on confirmation |
| Stale staging           | Uploads older than 24 hours                             | Reaped automatically                                                                   |

`integrity.quarantine` takes the names of reported unreferenced files, checks each is still unreferenced while no file transaction is running, deletes its `yt_files` row, and moves the file to `.orphans/` with the row's details beside it. `integrity.purge` deletes quarantined files by name. The last report is kept in memory as `integrity.last` until the process restarts or a backup is restored.

## Storage usage

Reported per application: database size, file count and bytes by type group, backup count and bytes, and free space on the data and backup volumes.

## Recovery expectations

| Measure                     | Target                                                                |
| --------------------------- | --------------------------------------------------------------------- |
| Data loss, normal operation | Up to one backup interval (24 hours by default)                       |
| Data loss, upgrade          | None; a verified backup is taken immediately before migrating         |
| Recovery time               | Restoring a backup from the data page, typically minutes for a few GB |

## Recovery runbook

Commands run on the host that runs the application, in the application directory of a checkout of this repository at the deployed commit. `<id>` is a backup id from `yt-data list`.

| Situation                          | Steps                                                                                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upgrade blocked                    | Follow the maintenance screen: run the version it names, or restore a compatible backup from that screen                                                             |
| Integrity check reports corruption | Data page → Backups → restore the newest verified backup                                                                                                             |
| Application does not load at all   | `docker compose exec app yt-data restore <id>`; if the container does not stay up, `docker compose stop app` then `docker compose run --rm app yt-data restore <id>` |
| Data volume lost                   | Start the application on an empty volume, put the archive in the backup directory, `docker compose exec app yt-data restore <id>`                                    |
| One file missing or damaged        | `tar -xf <archive> documents/<storage key>` and copy it into `<dataDir>/documents/`, then rescan                                                                     |
| Backups stale or failing           | Data page → Automatic backups shows the last error; check `BACKUP_DIR` mount and free space; run **Back up now**                                                     |

### Moving data to another computer

The backup directory is the named volume `<app>-backups` unless `<APP>_BACKUP_DIR` names a host path, for example `PASSBOOK_BACKUP_DIR=/srv/backups/passbook`. A host path lets `rsync` or `scp` copy archives between computers; with the named volume, use `docker compose cp`.

```sh
# on the source computer
docker compose exec app yt-data backup
docker compose cp app:/backups/<id>.ytbackup .

# on the destination computer, with the application running
docker compose cp <id>.ytbackup app:/backups/
docker compose exec app yt-data restore <id>
```

The destination restores backups from the same or an older application version; it refuses a backup from a newer version until it runs that version.
