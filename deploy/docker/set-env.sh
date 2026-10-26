#!/usr/bin/env bash
# Set (or change) one setting and restart the API. The value is typed hidden, so it never lands in your shell history.
#   bash deploy/docker/set-env.sh GEMINI_API_KEY
#   bash deploy/docker/set-env.sh SMTP_PASS
set -euo pipefail
cd "$(dirname "$0")"
KEY=${1:?usage: set-env.sh SETTING_NAME}
case "$KEY" in *[!A-Z0-9_]*|"") echo "Setting names use CAPITAL_LETTERS_AND_UNDERSCORES." >&2; exit 1 ;; esac
[ -f .env ] || { echo "Run configure.sh first." >&2; exit 1; }
read -r -s -p "Value for $KEY (typed hidden; leave empty to clear): " VALUE; echo
case "$VALUE" in *"'"*) echo "Please avoid the ' (apostrophe) character." >&2; exit 1 ;; esac
tmp=$(mktemp); umask 077
grep -v "^$KEY=" .env > "$tmp" || true
printf "%s='%s'\n" "$KEY" "$VALUE" >> "$tmp"
cat "$tmp" > .env; rm -f "$tmp"; chmod 600 .env
docker compose -f docker-compose.yml --env-file .env up -d
echo "✅ $KEY saved; the affected services were restarted."
