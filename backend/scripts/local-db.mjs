// Local PostgreSQL 16 for development — no Docker or system install needed.
// Runs on localhost:5432 (postgres/postgres, database kenya_sme) — the same
// settings backend/.env uses. Data is kept in backend/data/pg. Ctrl+C to stop.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const databaseDir = join(import.meta.dirname, '..', 'data', 'pg');
const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port: 5432,
  persistent: true,
});

if (!existsSync(join(databaseDir, 'PG_VERSION'))) {
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase('kenya_sme');
} catch {
  // Already exists
}
console.log('PostgreSQL running on localhost:5432 (database kenya_sme). Press Ctrl+C to stop.');

const shutdown = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
setInterval(() => {}, 1 << 30);
