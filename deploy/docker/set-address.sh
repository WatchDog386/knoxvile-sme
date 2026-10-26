#!/usr/bin/env bash
# Switch the public web address (e.g. from testing by IP to the real domain) and restart.
#   bash deploy/docker/set-address.sh sme.knoxvilletechnologies.com
#   bash deploy/docker/set-address.sh ip          # back to plain http://<server ip>
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "Run configure.sh first." >&2; exit 1; }
TARGET=${1:?usage: set-address.sh <domain|ip>}
if [ "$TARGET" = "ip" ]; then
  SITE=":80"; ORIGIN="http://$(hostname -I | awk '{print $1}')"
else
  SITE="$TARGET"; ORIGIN="https://$TARGET"
fi
tmp=$(mktemp); umask 077
grep -vE '^(SITE_ADDRESS|FRONTEND_URL|CORS_ORIGIN)=' .env > "$tmp"
printf 'SITE_ADDRESS=%s\nFRONTEND_URL=%s\nCORS_ORIGIN=%s\n' "$SITE" "$ORIGIN" "$ORIGIN" >> "$tmp"
cat "$tmp" > .env; rm -f "$tmp"; chmod 600 .env
docker compose -f docker-compose.yml --env-file .env up -d
echo "✅ Address is now $ORIGIN"
[ "$TARGET" = "ip" ] || echo "   HTTPS is requested automatically; it works once DNS for $TARGET points at this server (give it a minute)."
