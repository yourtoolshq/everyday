#!/bin/sh
set -eu

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ "$#" -ne 1 ]; then
  echo "Usage: pnpm restore -- /path/to/tenure-backup.db" >&2
  exit 1
fi

source_file="$1"
if [ ! -f "$source_file" ]; then
  echo "Backup not found: $source_file" >&2
  exit 1
fi

container_id=$(docker compose ps -q app)
if [ -z "$container_id" ]; then
  echo "Tenure is not running. Start it before restoring a backup." >&2
  exit 1
fi

docker cp "$source_file" "$container_id:/data/tenure.db.restore"
if ! integrity_check=$(docker compose exec -T app sqlite3 /data/tenure.db.restore "pragma integrity_check;" 2>/dev/null); then
  docker compose exec -T app rm -f /data/tenure.db.restore
  echo "Backup is not a readable SQLite database and was not restored." >&2
  exit 1
fi
if [ "$integrity_check" != "ok" ]; then
  docker compose exec -T app rm -f /data/tenure.db.restore
  echo "Backup failed SQLite integrity validation and was not restored." >&2
  exit 1
fi

docker compose stop app
docker run --rm -v tenure-data:/data alpine:3.22 sh -c "rm -f /data/tenure.db /data/tenure.db-shm /data/tenure.db-wal && mv /data/tenure.db.restore /data/tenure.db && chown 1001:1001 /data/tenure.db"
docker compose up -d app
echo "Backup restored and Tenure restarted."
