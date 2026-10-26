#!/usr/bin/env bash
#
# Sets up EMAIL (SMTP) and/or WHATSAPP (Meta Cloud API) on this server, with
# passwords and tokens typed hidden: they never show on screen, in shell
# history or in chat. Each part can be skipped. Run on the server:
#
#   sudo bash /opt/business-sme/deploy/configure-messaging.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/business-sme}"
ENV_FILE="$APP_DIR/backend/.env"
SERVICE="${SERVICE:-business-sme}"

[[ $EUID -eq 0 ]] || { echo "Run with sudo: sudo bash $0"; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Cannot find $ENV_FILE"; exit 1; }

clean() { printf '%s' "$1" | tr -d '\r\n'; }
clean_all() { printf '%s' "$1" | tr -d '[:space:]"'; }
# Replace KEY=... in .env (or add it). Values with spaces or symbols are
# quoted so characters like # or spaces in a password are kept exactly.
set_env() {
  local key="$1" value="$2"
  sed -i -E "/^${key}=/d" "$ENV_FILE"
  if [[ "$value" =~ ^[A-Za-z0-9._@:/+-]*$ ]]; then
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  elif [[ "$value" != *"'"* ]]; then
    printf "%s='%s'\n" "$key" "$value" >> "$ENV_FILE"
  else
    local escaped="${value//\\/\\\\}"; escaped="${escaped//\"/\\\"}"
    printf '%s="%s"\n' "$key" "$escaped" >> "$ENV_FILE"
  fi
}

BACKUP="$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"
cp -p "$ENV_FILE" "$BACKUP"
sed -i 's/\r$//' "$ENV_FILE"
CHANGED=0

echo "== Email (SMTP) =="
read -rp "Set up email now? [y/N]: " DO_EMAIL
if [[ "${DO_EMAIL,,}" == y* ]]; then
  read -rp "SMTP server [mail.knoxville.co.ke]: " HOST; HOST="$(clean_all "${HOST:-mail.knoxville.co.ke}")"
  read -rp "Port (465 = SSL, 587 = STARTTLS) [465]: " PORT; PORT="$(clean_all "${PORT:-465}")"
  read -rp "Email address that sends (login): " USER_; USER_="$(clean_all "$USER_")"
  echo "Email password (nothing will show while you type/paste):"
  read -rs PASS; echo; PASS="$(clean "$PASS")"
  read -rp "Sender name [Knoxville Technologies]: " NAME; NAME="$(clean "${NAME:-Knoxville Technologies}")"
  [[ -n "$USER_" && -n "$PASS" ]] || { echo "Email address and password are required. Email skipped."; USER_=""; }
  if [[ -n "$USER_" ]]; then
    set_env SMTP_HOST "$HOST"
    set_env SMTP_PORT "$PORT"
    if [[ "$PORT" == "465" ]]; then set_env SMTP_SECURE true; else set_env SMTP_SECURE false; fi
    set_env SMTP_USER "$USER_"
    set_env SMTP_PASS "$PASS"
    set_env SMTP_FROM "$NAME <$USER_>"
    CHANGED=1
    echo "Email saved."
  fi
fi

echo
echo "== WhatsApp (Meta WhatsApp Cloud API) =="
read -rp "Set up WhatsApp now? [y/N]: " DO_WA
if [[ "${DO_WA,,}" == y* ]]; then
  echo "Permanent access token (nothing will show while you paste):"
  read -rs TOKEN; echo; TOKEN="$(clean_all "$TOKEN")"
  read -rp "Phone number ID (digits, from WhatsApp Manager / API Setup): " PNID; PNID="$(clean_all "$PNID")"
  read -rp "Approved template name [payment_reminder]: " TPL; TPL="$(clean_all "${TPL:-payment_reminder}")"
  read -rp "Template language code [en]: " LANG_; LANG_="$(clean_all "${LANG_:-en}")"
  if [[ -n "$TOKEN" && -n "$PNID" ]]; then
    set_env WHATSAPP_TOKEN "$TOKEN"
    set_env WHATSAPP_PHONE_NUMBER_ID "$PNID"
    set_env WHATSAPP_TEMPLATE "$TPL"
    set_env WHATSAPP_TEMPLATE_LANG "$LANG_"
    CHANGED=1
    echo "WhatsApp saved."
  else
    echo "Token and phone number ID are required. WhatsApp skipped."
  fi
fi

if [[ "$CHANGED" == 1 ]]; then
  chmod 600 "$ENV_FILE"
  OWNER="$(stat -c %U "$BACKUP")"; chown "$OWNER" "$ENV_FILE" 2>/dev/null || true
  systemctl restart "$SERVICE"
  echo
  echo "Saved to $ENV_FILE (backup: $BACKUP) and restarted $SERVICE."
  echo "Send a reminder from a subscriber's Prompt sheet to use it."
else
  rm -f "$BACKUP"
  echo "Nothing changed."
fi
unset PASS TOKEN
