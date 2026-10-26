#!/usr/bin/env bash
#
# Sets up M-Pesa prompts (Daraja STK push / M-Pesa Express) on this server,
# with the consumer secret and passkey typed hidden: they never show on
# screen, in shell history or in chat. Works for the Daraja sandbox app now
# and for the live app later (run it again and pick production). Run:
#
#   sudo bash /opt/business-sme/deploy/configure-mpesa.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/business-sme}"
ENV_FILE="$APP_DIR/backend/.env"
SERVICE="${SERVICE:-business-sme}"
DOMAIN="${DOMAIN:-sme.knoxvilletechnologies.com}"
# Safaricom's published test shortcode and passkey for the sandbox
SANDBOX_SHORTCODE=174379
SANDBOX_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919

[[ $EUID -eq 0 ]] || { echo "Run with sudo: sudo bash $0"; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Cannot find $ENV_FILE"; exit 1; }

clean_all() { printf '%s' "$1" | tr -d '[:space:]"'"'"; }
set_env() {
  local key="$1" value="$2"
  sed -i -E "/^${key}=/d" "$ENV_FILE"
  printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
}

echo "== M-Pesa prompts (Daraja STK push) =="
read -rp "Which Daraja app: sandbox (testing) or production (live)? [sandbox]: " MODE
MODE="$(clean_all "${MODE:-sandbox}")"
if [[ "${MODE,,}" == p* ]]; then MODE=production; else MODE=sandbox; fi

read -rp "Consumer Key: " KEY; KEY="$(clean_all "$KEY")"
echo "Consumer Secret (nothing will show while you paste):"
read -rs SECRET; echo; SECRET="$(clean_all "$SECRET")"

if [[ "$MODE" == sandbox ]]; then
  read -rp "Short code [$SANDBOX_SHORTCODE]: " SHORTCODE; SHORTCODE="$(clean_all "${SHORTCODE:-$SANDBOX_SHORTCODE}")"
  echo "Passkey (press Enter for the standard sandbox passkey; nothing shows while you paste):"
  read -rs PASSKEY; echo; PASSKEY="$(clean_all "${PASSKEY:-$SANDBOX_PASSKEY}")"
  TILL=""
else
  read -rp "Paybill / store number the prompt is sent from: " SHORTCODE; SHORTCODE="$(clean_all "$SHORTCODE")"
  echo "Passkey (from Safaricom's go-live email; nothing will show while you paste):"
  read -rs PASSKEY; echo; PASSKEY="$(clean_all "$PASSKEY")"
  read -rp "Till number, only if customers pay a Buy Goods till (leave empty for paybill): " TILL; TILL="$(clean_all "$TILL")"
fi

[[ -n "$KEY" && -n "$SECRET" && -n "$SHORTCODE" && -n "$PASSKEY" ]] || { echo "Key, secret, short code and passkey are all required. Nothing changed."; exit 1; }
[[ "$SHORTCODE" =~ ^[0-9]+$ ]] || { echo "The short code must be digits only. Nothing changed."; exit 1; }

# Check the key and secret with Safaricom before saving them
if [[ "$MODE" == production ]]; then BASE=https://api.safaricom.co.ke; else BASE=https://sandbox.safaricom.co.ke; fi
echo "Checking the keys with Safaricom..."
CODE="$(curl -s -o /dev/null -w '%{http_code}' -u "$KEY:$SECRET" "$BASE/oauth/v1/generate?grant_type=client_credentials" || true)"
if [[ "$CODE" != 200 ]]; then
  echo "Safaricom rejected the Consumer Key/Secret (HTTP $CODE) for $MODE."
  echo "Check you copied them from the right app (sandbox vs production). Nothing changed."
  exit 1
fi
echo "Keys accepted."

BACKUP="$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"
cp -p "$ENV_FILE" "$BACKUP"
sed -i 's/\r$//' "$ENV_FILE"

set_env MPESA_ENV "$MODE"
set_env MPESA_CONSUMER_KEY "$KEY"
set_env MPESA_CONSUMER_SECRET "$SECRET"
set_env MPESA_SHORTCODE "$SHORTCODE"
set_env MPESA_PASSKEY "$PASSKEY"
set_env MPESA_TILL "$TILL"
set_env MPESA_CALLBACK_URL "https://$DOMAIN/api/v1/payments/mpesa/callback"

chmod 600 "$ENV_FILE"
OWNER="$(stat -c %U "$BACKUP")"; chown "$OWNER" "$ENV_FILE" 2>/dev/null || true
systemctl restart "$SERVICE"
unset SECRET PASSKEY

echo
echo "Saved ($MODE) to $ENV_FILE (backup: $BACKUP) and restarted $SERVICE."
if [[ "$MODE" == sandbox ]]; then
  echo "Sandbox: prompts reach real Safaricom phones but no money moves."
  echo "A sandbox prompt that is accepted is still recorded as paid in the app, so test only on a test subscriber."
  echo "Switch to production once Safaricom gives you the live app."
else
  echo "Live: subscribers now get real M-Pesa prompts from the app."
fi
