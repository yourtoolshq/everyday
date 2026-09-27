#!/bin/sh
set -eu

mkdir -p /data /data/documents /backups
chown -R nextjs:nodejs /data
chown nextjs:nodejs /backups

if [ "$#" -gt 0 ]; then
  exec "$@"
fi
exec su-exec nextjs node server.js
