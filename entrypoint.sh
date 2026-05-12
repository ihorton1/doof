#!/usr/bin/env sh
set -e

# Ensure data dir exists (Container Apps mounts the share at /data)
mkdir -p /data

# Run any pending migrations against the mounted SQLite file
echo "Running Prisma migrations..."
node /opt/prisma/node_modules/prisma/build/index.js migrate deploy

echo "Starting Next.js server..."
exec node server.js
