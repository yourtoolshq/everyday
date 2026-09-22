#!/bin/sh
set -eu

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ "$#" -ne 1 ]; then
  echo "Usage: pnpm backup -- /path/to/taxbook-backup.db" >&2
  exit 1
fi

destination="$1"
if [ -e "$destination" ]; then
  echo "Refusing to overwrite existing backup: $destination" >&2
  exit 1
fi
destination_dir=$(dirname "$destination")
mkdir -p "$destination_dir"
container_id=$(docker compose ps -q app)

if [ -z "$container_id" ]; then
  echo "Tax Book is not running. Start it with: docker compose up -d" >&2
  exit 1
fi

temporary_backup="/tmp/taxbook-backup-$$.db"
docker compose exec -T app sqlite3 /data/taxbook.db ".backup '$temporary_backup'"
docker cp "$container_id:$temporary_backup" "$destination"
docker compose exec -T app rm -f "$temporary_backup"
echo "Backup written to $destination"
