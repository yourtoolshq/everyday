#!/usr/bin/env bash
# Backs up a running Passbook container with yt-data, restores the archive into an empty
# data volume with the application stopped, and checks the restored data is served.
# Uses throwaway volumes only; never point it at passbook-data.
set -euo pipefail

image="${1:-passbook}"
run_id="${GITHUB_RUN_ID:-local}-$$"
container="passbook-round-trip-$run_id"
data_volume="passbook-round-trip-data-$run_id"
restored_volume="passbook-round-trip-restored-$run_id"
backup_volume="passbook-round-trip-backups-$run_id"
port="${ROUND_TRIP_PORT:-8081}"
base_url="http://127.0.0.1:$port"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker volume rm "$data_volume" "$restored_volume" "$backup_volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT

start_app() {
  docker run -d --name "$container" -p "$port:3000" \
    -v "$1:/data" -v "$backup_volume:/backups" "$image" >/dev/null
  for _ in $(seq 1 30); do
    # Health answers 200 with status "maintenance" while the data is upgrading.
    if curl -fsS "$base_url/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
      return 0
    fi
    sleep 2
  done
  docker logs "$container" || true
  echo "Passbook did not become ready" >&2
  return 1
}

household_initialized() {
  curl -fsS "$base_url/api/trpc/setup.state" | grep -q '"initialized":true'
}

stop_app() {
  docker rm -f "$container" >/dev/null
}

start_app "$data_volume"
curl -fsS -X POST "$base_url/api/trpc/setup.initialize" \
  -H "content-type: application/json" \
  -d '{"json":{"householdName":"Round trip household","people":["Alex Example"]}}' >/dev/null
household_initialized

backup_output="$(docker exec "$container" yt-data backup)"
echo "$backup_output"
backup_id="$(echo "$backup_output" | sed -n 's/^Created backup \(.*\): verified$/\1/p')"
if [ -z "$backup_id" ]; then
  echo "yt-data backup did not report a verified backup" >&2
  exit 1
fi
stop_app

docker run --rm -v "$restored_volume:/data" -v "$backup_volume:/backups" \
  "$image" yt-data restore "$backup_id"

start_app "$restored_volume"
if ! household_initialized; then
  echo "The restored data does not contain the household" >&2
  exit 1
fi
docker exec "$container" yt-data list
echo "Backup round trip passed"
