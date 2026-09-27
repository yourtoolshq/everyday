#!/bin/sh
set -eu

mkdir -p /data /data/documents
chown -R nextjs:nodejs /data
if [ -n "${BACKUP_DIR:-}" ]; then
  mkdir -p "$BACKUP_DIR"
  chown nextjs:nodejs "$BACKUP_DIR"
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi
exec su-exec nextjs node server.js
