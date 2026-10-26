#!/usr/bin/env bash
#
# Sets up Mobile Sasa SMS on this server without the token ever showing on
# screen, in shell history or in chat. Run on the server:
#
#   sudo bash /opt/business-sme/deploy/configure-sms.sh
#
# It asks for the API token (hidden typing), the sender ID and, optionally,
# the webhook signing secret, writes them to backend/.env (keeping a backup),
# restarts the API and sends a test SMS.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/business-sme}"
ENV_FILE="$APP_DIR/backend/.env"
SERVICE="${SERVICE:-business-sme}"
API_URL="https://api.mobilesasa.com/v1/send/message"

[[ $EUID -eq 0 ]] || { echo "Run with sudo: sudo bash $0"; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Cannot find $ENV_FILE"; exit 1; }

echo "== Mobile Sasa SMS setup =="
echo "Paste the API token and press Enter (nothing will show while you paste):"
read -rs TOKEN; echo
TOKEN="$(printf '%s' "$TOKEN" | tr -d '[:space:]"')"
[[ -n "$TOKEN" ]] || { echo "No token entered. Nothing changed."; exit 1; }
echo "Token received (${#TOKEN} characters)."

read -rp "Sender ID [KNOXVILLE]: " SENDER
SENDER="${SENDER:-KNOXVILLE}"
SENDER="$(printf '%s' "$SENDER" | tr -d '[:space:]"')"

echo "Optional: paste the webhook signing secret (whsec_...) for delivery reports,"
echo "or just press Enter to skip (nothing will show while you paste):"
read -rs WHSEC; echo
WHSEC="$(printf '%s' "$WHSEC" | tr -d '[:space:]"')"

# Backup, then replace any earlier SMS lines with the new ones
BACKUP="$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"
cp -p "$ENV_FILE" "$BACKUP"
sed -i 's/\r$//' "$ENV_FILE"
sed -i -E '/^(SMS_PROVIDER|BULKSMS_API_URL|BULKSMS_API_KEY|BULKSMS_SENDER_ID|BULKSMS_AUTH_HEADER)=/d' "$ENV_FILE"
if [[ -n "$WHSEC" ]]; then sed -i -E '/^MOBILESASA_WEBHOOK_SECRET=/d' "$ENV_FILE"; fi
{
  echo ""
  echo "# --- SMS: Mobile Sasa (set by deploy/configure-sms.sh) ---"
  echo "SMS_PROVIDER=mobilesasa"
  echo "BULKSMS_API_URL=$API_URL"
  echo "BULKSMS_API_KEY=$TOKEN"
  echo "BULKSMS_SENDER_ID=$SENDER"
  if [[ -n "$WHSEC" ]]; then echo "MOBILESASA_WEBHOOK_SECRET=$WHSEC"; fi
} >> "$ENV_FILE"
chmod 600 "$ENV_FILE"
# Keep the file readable by the account the API runs as
OWNER="$(stat -c %U "$BACKUP")"; chown "$OWNER" "$ENV_FILE" 2>/dev/null || true
echo "Saved to $ENV_FILE (backup: $BACKUP)."

systemctl restart "$SERVICE"
echo "Restarted $SERVICE."

read -rp "Your phone number for a test SMS (e.g. 0712345678), or Enter to skip: " PHONE
if [[ -n "$PHONE" ]]; then
  DIGITS="$(printf '%s' "$PHONE" | tr -cd '0-9')"
  if [[ "$DIGITS" =~ ^0[0-9]{9}$ ]]; then DIGITS="254${DIGITS:1}"; fi
  echo "Sending a test SMS to $DIGITS ..."
  REPLY_JSON="$(curl -s -X POST "$API_URL" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "Accept: application/json" \
    -d "{\"senderID\":\"$SENDER\",\"phone\":\"$DIGITS\",\"message\":\"Knoxville SMS test: setup complete.\"}")"
  echo "Mobile Sasa replied: $REPLY_JSON"
  if printf '%s' "$REPLY_JSON" | grep -q '"status":true'; then
    echo "SUCCESS: SMS is working. Check your phone."
  else
    echo "Not sent. If it mentions the token, create a new token with the 'Send messages' scope;"
    echo "if it mentions the sender, use the exact approved sender ID. Then run this script again."
  fi
fi
unset TOKEN WHSEC
