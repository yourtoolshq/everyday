# Taxbook Phase 4 host cutover checklist

This runs later, on the computer that owns Taxbook's data, after the adoption pull request is merged. Taxbook keeps running through **Prepare**. It is down from **Take the rollback copy** until the new container is healthy or rollback finishes.

Production and development may share a computer and must not share data. The production container uses `taxbook-data` and `taxbook-backups` and is reached only at `https://taxbook.tools.local`.

## Prepare

Record the live container, image, Compose directory, networks, and mounts:

```sh
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}' | grep -i taxbook
legacy=<container name>
docker inspect "$legacy" --format '{{range .Mounts}}{{.Type}} {{if .Name}}{{.Name}}{{else}}{{.Source}}{{end}} -> {{.Destination}}{{println}}{{end}}'
docker inspect "$legacy" --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}  {{.Config.Image}}'
```

Expect the live database and files on the named volume `taxbook-data` mounted at `/data`. If the mount layout differs, stop and do not continue.

Tag the running image so the new build cannot replace it. Legacy and monorepo images can share the name `<directory>-app`:

```sh
docker tag "$(docker inspect "$legacy" --format '{{.Image}}')" taxbook-legacy
```

Check out the reviewed monorepo commit (this is "get latest from main" once the adoption PR is on main), then build:

```sh
git clone git@github.com:yourtoolshq/everyday.git ~/everyday   # or: git -C ~/everyday fetch && git -C ~/everyday checkout main && git -C ~/everyday pull
cd ~/everyday/apps/taxbook
APP_VERSION=$(git rev-parse --short HEAD) docker compose build
```

Optional host backup directory instead of the named backup volume:

```sh
echo 'TAXBOOK_BACKUP_DIR=/path/to/backups/taxbook' >> ~/everyday/apps/taxbook/.env
```

Confirm the built Compose file publishes no host port, joins only the external `web` network, sets `traefik.docker.network=web`, and routes `https://taxbook.tools.local`.

## Take the rollback copy

Stop the legacy app. Never pass `-v` to `docker compose down`; that deletes the volume.

```sh
(cd "$legacy_dir" && docker compose down)
docker ps --filter volume=taxbook-data   # expect no containers
```

Tar `/data` while it is stopped, so `taxbook.db` and `documents/` are one point in time. Checksum it, list the archive, then copy the tar and checksum off the computer and outside any Git checkout:

```sh
mkdir -p "$HOME/taxbook-cutover"
docker run --rm -v taxbook-data:/volume:ro -v "$HOME/taxbook-cutover":/out alpine:3.20 \
  sh -c 'tar -C /volume -cf /out/taxbook-data.tar . && cd /out && sha256sum taxbook-data.tar > taxbook-data.tar.sha256'
tar -tf "$HOME/taxbook-cutover/taxbook-data.tar" | head
docker run --rm -v "$HOME/taxbook-cutover":/out alpine:3.20 sh -c 'cd /out && sha256sum -c taxbook-data.tar.sha256'
```

Before starting the new image, unpack only a read-only copy of the database from the rollback archive and record the legacy attachment totals. Taxbook's previous release stores file bytes in SQLite BLOB columns; the platform migration drops those columns after the boot exporter writes the bytes to `/data/documents/`.

```sh
mkdir -p "$HOME/taxbook-cutover/pre-migration"
tar -xf "$HOME/taxbook-cutover/taxbook-data.tar" -C "$HOME/taxbook-cutover/pre-migration" taxbook.db
python3 - "$HOME/taxbook-cutover/pre-migration/taxbook.db" <<'PY' | tee "$HOME/taxbook-cutover/legacy-attachment-totals.tsv"
import sqlite3
import sys

db = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
tables = (
    "record_attachments",
    "tax_document_attachments",
    "business_record_attachments",
    "filing_attachments",
    "assessment_attachments",
    "cra_reference_document_attachments",
)
print("table\trows\tsize_bytes\tblob_bytes")
for table in tables:
    exists = db.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)
    ).fetchone()
    if exists is None:
        print(f"Confirmed absent in archived schema: {table}", file=sys.stderr)
        print(f"{table}\t0\t0\t0")
        continue
    row = db.execute(
        f"SELECT count(*), coalesce(sum(size_bytes), 0), coalesce(sum(length(data)), 0) FROM {table}"
    ).fetchone()
    print(f"{table}\t{row[0]}\t{row[1]}\t{row[2]}")
db.close()
PY
```

Keep this totals file beside the off-computer rollback archive. For each table, `size_bytes` and `blob_bytes` should match. If a legacy table is absent in a particular installation, record that explicitly as zero only after confirming the table is absent in the archived schema. Do not start the candidate image if a BLOB is missing, its length differs from `size_bytes`, or the archive checksum failed.

## Start the monorepo image on the existing data volume

```sh
cd ~/everyday/apps/taxbook
docker compose up -d
until curl -fsS https://taxbook.tools.local/api/health | grep -q '"status":"ok"'; do sleep 2; done
curl -fsS https://taxbook.tools.local/api/health
docker compose exec app yt-data list
```

While the migration runs, `https://taxbook.tools.local` shows "Upgrading your data". `yt-data list` must show one verified `pre-migration` backup. Health must include `"backup":{"status":"ok"` and `"sharesDataDir":false`. If health shows `"state":"blocked"`, or the container keeps restarting, run `docker compose logs app` and roll back.

Before accepting the migration, compare the six attachment-table row counts and total `size_bytes` below with the saved legacy totals. The per-table counts and byte totals must match, every attachment must join to one `yt_files` row, the old `data` columns must be gone, and SQLite integrity and foreign-key checks must be clean. This command only reads the migrated database:

```sh
docker compose exec -T app node <<'NODE'
const { createClient } = require("@libsql/client");

const tables = [
  "record_attachments",
  "tax_document_attachments",
  "business_record_attachments",
  "filing_attachments",
  "assessment_attachments",
  "cra_reference_document_attachments",
];

(async () => {
  const db = createClient({ url: "file:/data/taxbook.db" });
  try {
    for (const table of tables) {
      const columns = await db.execute(`PRAGMA table_info(${table})`);
      if (columns.rows.some((column) => column.name === "data")) {
        throw new Error(`${table} still has its legacy BLOB column`);
      }
      const totals = await db.execute(`
        SELECT count(*) AS rows,
               coalesce(sum(a.size_bytes), 0) AS size_bytes,
               coalesce(sum(CASE WHEN f.id IS NULL THEN 1 ELSE 0 END), 0) AS missing_files
        FROM ${table} a
        LEFT JOIN yt_files f ON f.id = a.file_id
      `);
      const row = totals.rows[0];
      console.log(`${table}\t${row.rows}\t${row.size_bytes}\tmissing_files=${row.missing_files}`);
      if (Number(row.missing_files) !== 0) {
        throw new Error(`${table} contains an attachment without a platform file`);
      }
    }
    const integrity = await db.execute("PRAGMA integrity_check");
    if (integrity.rows.length !== 1 || integrity.rows[0].integrity_check !== "ok") {
      throw new Error(`SQLite integrity check failed: ${JSON.stringify(integrity.rows)}`);
    }
    const foreignKeys = await db.execute("PRAGMA foreign_key_check");
    if (foreignKeys.rows.length !== 0) {
      throw new Error(`Foreign-key check failed: ${JSON.stringify(foreignKeys.rows)}`);
    }
    console.log("SQLite integrity and foreign-key checks passed");
  } finally {
    db.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
NODE
```

Compare each printed `rows` and `size_bytes` value to its corresponding line in `legacy-attachment-totals.tsv`. Then run Data & backups → Integrity → Scan now; the scan must re-read all migrated files successfully. Open representative PDFs and images. If any totals differ, a file is missing, or an integrity check fails, stop validation and follow **Roll back if validation fails** while retaining the original tar.

Then, on the real site, with fictional spot checks only where new writes are required:

- Records and files match the pre-cutover state. Open representative PDFs and images.
- Data & backups → Integrity → Scan now. The first scan records checksums. Database structure, relationships, and stored files are intact.
- Back up now. Verify that backup. Download the `.ytbackup` and confirm `tar -tf` lists `manifest.json`, the database, and the documents.
- Restart: `docker compose restart`. Data remains, and `yt-data list` shows no extra `pre-migration` backup.
- `docker compose exec app yt-data backup` prints `Created backup <id>: verified`. `yt-data verify <id>` agrees.
- `pnpm dev` on port 3000 with `DATA_DIR=./.data` runs while production is up and does not see `taxbook-data`.
- No production host port is published. `docker ps` shows no `0.0.0.0` or `127.0.0.1` mapping for this app.

## Roll back if validation fails

```sh
cd ~/everyday/apps/taxbook && docker compose down
docker run --rm -v taxbook-data:/volume:ro -v "$HOME/taxbook-cutover":/out alpine:3.20 \
  tar -C /volume -cf /out/taxbook-data-failed.tar .
docker run --rm -v taxbook-data:/volume -v "$HOME/taxbook-cutover":/in:ro alpine:3.20 \
  sh -c 'find /volume -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar -C /volume -xpf /in/taxbook-data.tar'
docker tag taxbook-legacy "$legacy_image"
(cd "$legacy_dir" && docker compose up -d)
```

Confirm the legacy app loads and representative files open. Keep both archives. Do not retry against production until the failure is understood.

## Close out

Keep the off-computer tar for at least 30 days. Record the deployed commit on the Phase 4 tracking issue. Remove the `taxbook-legacy` image tag only after that hold. The host manager keeps pinning that commit; a later host rebuild must not move production forward by itself.
