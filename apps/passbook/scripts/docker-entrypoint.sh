#!/bin/sh
set -eu

mkdir -p /data /data/documents
chown -R nextjs:nodejs /data
exec su-exec nextjs node server.js
