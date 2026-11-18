#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -z "${BOLTS_DATABASE_URL:-}" || -z "${BOLTS_APP_PASSWORD:-}" || -z "${BOLTS_COOKIE_SECRET:-}" || ${#BOLTS_COOKIE_SECRET} -lt 16 ]]; then
  echo "BOLTS_DATABASE_URL, BOLTS_APP_PASSWORD and BOLTS_COOKIE_SECRET (16+ characters) must be configured." >&2
  exit 1
fi

cp /app/infra/nginx.conf.template /tmp/nginx.conf
nginx -t -c /tmp/nginx.conf

# Ensure data dir exists (Container Apps mounts the share at /data)
mkdir -p /data

# Run pending migrations before serving traffic.
echo "Running Prisma migrations..."
PATH="/opt/prisma/node_modules/.bin:$PATH" prisma migrate deploy

if [[ -n "${BOLTS_DATABASE_URL:-}" ]]; then
  echo "Running Bolts Prisma migrations..."
  PATH="/opt/prisma/node_modules/.bin:$PATH" prisma migrate deploy \
    --schema /opt/bolts/apps/bolts/prisma/schema.prisma
fi

pids=()
shutdown() {
  trap '' TERM INT
  kill -TERM "${pids[@]}" 2>/dev/null || true
  wait "${pids[@]}" 2>/dev/null || true
}
trap 'shutdown; exit 143' TERM
trap 'shutdown; exit 130' INT
trap shutdown EXIT

echo "Starting Doof on internal port 3002..."
env -u BOLTS_DATABASE_URL -u BOLTS_APP_PASSWORD -u BOLTS_COOKIE_SECRET PORT=3002 HOSTNAME=127.0.0.1 node server.js &
pids+=("$!")

echo "Starting Bolts on internal port 3001 (path: /bolts)..."
env -u DATABASE_URL -u APP_PASSWORD -u COOKIE_SECRET \
  PORT=3001 HOSTNAME=127.0.0.1 node /opt/bolts/apps/bolts/server.js &
pids+=("$!")

echo "Starting shared ingress on port 3000..."
nginx -c /tmp/nginx.conf -g 'daemon off;' &
pids+=("$!")

status=0
wait -n "${pids[@]}" || status=$?
echo "A shared-container service exited (status $status); stopping all services." >&2
if [[ "$status" -eq 0 ]]; then
  status=1
fi
exit "$status"
