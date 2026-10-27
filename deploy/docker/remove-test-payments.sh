#!/usr/bin/env bash
# Removes the paybill webhook TEST payments (TransID TEST0001…TEST0009) and everything they created:
# their sales, payment rows and the customers/subscribers added automatically for them.
# Real payments are never touched. A database backup is taken first.
#   bash deploy/docker/remove-test-payments.sh
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "Run this on the server, from the knoxvile-sme folder." >&2; exit 1; }
# The database container already knows its own user and database name
psql() { docker compose -f docker-compose.yml --env-file .env exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' psql "$@"; }

IDS="'TEST0001','TEST0002','TEST0003','TEST0004','TEST0005','TEST0006','TEST0007','TEST0008','TEST0009'"
KEYS="SELECT 'mpesa-' || t || '-' || k FROM unnest(ARRAY[$IDS]) t, unnest(ARRAY['payment','unmatched','package','credit']) k"
SALES="SELECT id FROM sales WHERE idempotency_key IN ($KEYS)"
CUSTOMERS="SELECT id FROM customers WHERE notes LIKE 'Added automatically from M-Pesa payment TEST000_%'"

echo "This will remove:"
psql -At -c "SELECT '  paybill records: ' || count(*) FROM mpesa_c2b_transactions WHERE trans_id IN ($IDS);"
psql -At -c "SELECT '  sales:           ' || count(*) || ' (KES ' || COALESCE(sum(total),0) || ')' FROM sales WHERE id IN ($SALES);"
psql -At -c "SELECT '  customers:       ' || count(*) || COALESCE(' (' || string_agg(name || COALESCE(' ' || account_number, ''), ', ') || ')', '') FROM customers WHERE id IN ($CUSTOMERS);"
read -r -p "Go ahead? Type yes: " OK
[ "$OK" = "yes" ] || { echo "Nothing removed."; exit 0; }

mkdir -p backups
FILE="backups/before_test_cleanup_$(date +%Y%m%d_%H%M%S).dump"
docker compose -f docker-compose.yml --env-file .env exec -T db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$FILE"
echo "Backup saved: deploy/docker/$FILE"

psql <<SQL
BEGIN;
DELETE FROM payments   WHERE "saleId" IN ($SALES);
DELETE FROM sale_items WHERE "saleId" IN ($SALES);
DELETE FROM sales      WHERE id IN ($SALES);
DELETE FROM mpesa_c2b_transactions WHERE trans_id IN ($IDS);
-- The test customers, only if nothing real is recorded against them
DELETE FROM subscriptions WHERE "customerId" IN ($CUSTOMERS)
  AND "customerId" NOT IN (SELECT "customerId" FROM sales WHERE "customerId" IS NOT NULL);
DELETE FROM customers WHERE id IN ($CUSTOMERS)
  AND id NOT IN (SELECT "customerId" FROM sales WHERE "customerId" IS NOT NULL)
  AND id NOT IN (SELECT "customerId" FROM payments WHERE "customerId" IS NOT NULL)
  AND id NOT IN (SELECT "customerId" FROM subscriptions WHERE "customerId" IS NOT NULL)
  AND id NOT IN (SELECT "customerId" FROM call_logs WHERE "customerId" IS NOT NULL);
COMMIT;
SQL
echo "✅ Test payments removed. Real payments from the billing system will keep arriving as normal."
