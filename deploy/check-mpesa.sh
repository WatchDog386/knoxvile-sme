#!/usr/bin/env bash
#
# Checks whether paybill payments are reaching this server and being
# recorded. Prints no secrets. Run on the server:
#
#   sudo bash /opt/business-sme/deploy/check-mpesa.sh

APP_DIR="${APP_DIR:-/opt/business-sme}"
ENV_FILE="$APP_DIR/backend/.env"
SERVICE="${SERVICE:-business-sme}"
PORT="$(grep -E '^PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d '"'"'"' \r')"; PORT="${PORT:-4000}"
DB="$(grep -E '^DB_NAME=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d '"'"'"' \r')"; DB="${DB:-kenya_sme}"
# First 16 characters of the sha256 of the secret in the developer's code
DEV_SECRET_FP=791eaa5eff876d77

echo "== 1. Code version =="
git -C "$APP_DIR" log --oneline -1

echo; echo "== 2. App running =="
systemctl is-active "$SERVICE"

echo; echo "== 3. Webhook secret =="
SECRET="$(grep -E '^MPESA_WEBHOOK_SECRET=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r')"
if [[ -z "$SECRET" ]]; then
  echo "NOT SET: every payment the developer sends is refused."
elif [[ "$(printf '%s' "$SECRET" | sha256sum | cut -c1-16)" == "$DEV_SECRET_FP" ]]; then
  echo "Set, and matches the secret in the developer's code."
else
  echo "Set, but DIFFERENT from the secret in the developer's code: his payments are refused."
fi

echo; echo "== 4. Webhook answers on this server =="
curl -s -m 10 -X POST "http://127.0.0.1:$PORT/api/v1/payments/mpesa/c2b" \
  -H 'Content-Type: application/json' -H "X-Webhook-Secret: $SECRET" -d '{}'
echo "   (expected: ResultCode 1 'Rejected: TransID and a positive TransAmount are required')"
unset SECRET

echo; echo "== 5. Calls from the developer's system (web server log) =="
LOGS=$(ls /var/log/nginx/*access*.log /var/log/caddy/*.log 2>/dev/null)
if [[ -n "$LOGS" ]]; then
  grep -h "mpesa/c2b" $LOGS 2>/dev/null | tail -10
  echo "   count: $(grep -h "mpesa/c2b" $LOGS 2>/dev/null | wc -l) (200 = received, 401 = wrong secret, 503 = secret not set)"
else
  echo "   no nginx/caddy access log found"
fi

echo; echo "== 6. Payments recorded =="
sudo -u postgres psql -d "$DB" -X -c "SELECT status, COUNT(*), MAX(created_at) AS latest FROM mpesa_c2b_transactions GROUP BY status;" 2>&1
sudo -u postgres psql -d "$DB" -X -c "SELECT trans_id, amount, bill_ref, status, created_at FROM mpesa_c2b_transactions ORDER BY created_at DESC LIMIT 5;" 2>&1

echo; echo "== 7. App log, last 2 days =="
journalctl -u "$SERVICE" --since "2 days ago" --no-pager | grep -E "M-Pesa|C2b|webhook|Prompt" | tail -15
