#!/bin/sh
set -eu

mkdir -p /data /data/documents
chown -R nextjs:nodejs /data
su-exec nextjs node ./scripts/migrate.mjs
exec su-exec nextjs node server.js
