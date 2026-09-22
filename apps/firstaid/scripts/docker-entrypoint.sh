#!/bin/sh
set -eu

mkdir -p /data
chown nextjs:nodejs /data
exec su-exec nextjs node server.js

