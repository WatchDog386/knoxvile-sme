#!/usr/bin/env bash
# Build and (re)start Knoxville SME. Safe to run repeatedly — use it for every update.
#   bash deploy/docker/deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
REPO=$(cd ../.. && pwd)

[ -f .env ] || { echo "deploy/docker/.env not found. Run:  bash deploy/docker/configure.sh" >&2; exit 1; }
if grep -q "CHANGE_ME" .env; then echo "deploy/docker/.env still contains CHANGE_ME values." >&2; exit 1; fi

COMPOSE="docker compose -f docker-compose.yml --env-file .env"

# A fresh safety copy of the database before every update (skipped on the very first run)
if $COMPOSE ps --status running db 2>/dev/null | grep -q db; then
  echo "▶ Backing up the database before updating…"
  $COMPOSE exec -T backup sh /backup.sh once || echo "   (backup skipped)"
fi

if [ -d "$REPO/.git" ]; then
  echo "▶ Pulling latest code…"
  git -C "$REPO" pull --ff-only
fi

echo "▶ Building images (the first build takes several minutes)…"
$COMPOSE build

echo "▶ Starting services…"
$COMPOSE up -d --remove-orphans

echo "▶ Waiting for the API to become healthy…"
for i in $(seq 1 40); do
  state=$($COMPOSE ps --format '{{.Service}} {{.Health}}' api 2>/dev/null | awk '{print $2}')
  if [ "$state" = "healthy" ]; then
    echo "✅ Knoxville SME is up."
    $COMPOSE ps
    SITE=$(grep -E '^SITE_ADDRESS=' .env | cut -d= -f2-)
    case "$SITE" in :*) echo "   Open http://$(hostname -I | awk '{print $1}')" ;; *) echo "   Open https://$SITE" ;; esac
    exit 0
  fi
  sleep 3
done
echo "❌ The API did not become healthy. Recent logs:" >&2
$COMPOSE logs --tail=80 api >&2
exit 1
