#!/usr/bin/env bash
# Creates deploy/docker/.env with strong random secrets and your answers.
# Run as your normal user (NOT with sudo):   bash deploy/docker/configure.sh
set -euo pipefail
cd "$(dirname "$0")"
[ "$(id -u)" -ne 0 ] || { echo "Run this as your normal user, without sudo." >&2; exit 1; }

if [ -f .env ]; then
  echo "Already configured (deploy/docker/.env exists), so nothing was changed."
  echo "  • Change the web address:  bash deploy/docker/set-address.sh <domain|ip>"
  echo "  • Change another setting:  bash deploy/docker/set-env.sh SETTING_NAME"
  echo "  (Re-running configure would create a new database password that the existing database does not know.)"
  exit 0
fi

read -r -p "Web address [sme.knoxvilletechnologies.com] (type 'ip' to test by IP address only): " DOMAIN
DOMAIN=${DOMAIN:-sme.knoxvilletechnologies.com}
if [ "$DOMAIN" = "ip" ]; then
  IP=$(hostname -I | awk '{print $1}')
  SITE=":80"; ORIGIN="http://$IP"
else
  SITE="$DOMAIN"; ORIGIN="https://$DOMAIN"
fi
read -r -p "Admin e-mail [admin@knoxvilletechnologies.com]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@knoxvilletechnologies.com}
while true; do
  read -r -s -p "Admin password (8+ characters, typed hidden): " ADMIN_PASSWORD; echo
  case "$ADMIN_PASSWORD" in *"'"*) echo "Please avoid the ' (apostrophe) character."; continue ;; esac
  [ "${#ADMIN_PASSWORD}" -ge 8 ] && break
  echo "Too short — use at least 8 characters."
done
read -r -p "E-mail for HTTPS certificate notices [$ADMIN_EMAIL]: " ACME
ACME=${ACME:-$ADMIN_EMAIL}

umask 077
cat > .env <<ENV
# Knoxville SME production settings — created by configure.sh. Never commit this file.

# Public address (a domain gives automatic HTTPS; ':80' is plain HTTP for testing)
SITE_ADDRESS=$SITE
ACME_EMAIL=$ACME
HTTP_PORT=80
HTTPS_PORT=443

# Database
POSTGRES_USER=knoxville
POSTGRES_DB=kenya_sme
POSTGRES_PASSWORD=$(openssl rand -hex 24)

# API
JWT_SECRET=$(openssl rand -hex 48)
JWT_EXPIRES_IN=7d
FRONTEND_URL=$ORIGIN
CORS_ORIGIN=$ORIGIN
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD='$ADMIN_PASSWORD'

# Secret the paybill system sends with each payment (X-Webhook-Secret)
MPESA_WEBHOOK_SECRET=$(openssl rand -hex 32)

# Backups (written next to this file by default)
BACKUP_KEEP_DAYS=14
BACKUP_HOUR=1

# ── Optional integrations: add them later with  bash deploy/docker/set-env.sh KEY ──
# GEMINI_API_KEY, MPESA_*, BULKSMS_*, SMS_PROVIDER, MOBILESASA_WEBHOOK_SECRET,
# SMTP_HOST/PORT/SECURE/USER/PASS/FROM, WHATSAPP_TOKEN/PHONE_NUMBER_ID/TEMPLATE
# (see ../env.production.example for what each one does)
ENV
chmod 600 .env
echo
echo "✅ Wrote deploy/docker/.env (readable only by you)."
echo "   Next:  bash deploy/docker/deploy.sh"
