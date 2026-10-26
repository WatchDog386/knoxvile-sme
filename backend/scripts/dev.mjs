// Runs the API against the internal (embedded) PostgreSQL: starts it unless
// one is already listening on 5432, then runs the API. Ctrl+C stops both.
//   node scripts/dev.mjs           API in watch mode   (npm run start:dev)
//   node scripts/dev.mjs --built   built API, dist/    (npm run start:local)
// Data lives in backend/data/pg; delete that folder to start empty.
import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';

const PORT = 5432;
const databaseDir = join(import.meta.dirname, '..', 'data', 'pg');
const built = process.argv.includes('--built');

const portInUse = () =>
  new Promise((resolve) => {
    const socket = net.connect(PORT, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });

let pg = null;
if (await portInUse()) {
  console.log(`PostgreSQL already running on port ${PORT} — using it.`);
} else {
  pg = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: true,
    onLog: () => {},
  });
  if (!existsSync(join(databaseDir, 'PG_VERSION'))) {
    console.log('Creating local database (first run only)...');
    await pg.initialise();
  }
  // Nothing is listening, so a leftover lock is from a database that was
  // killed rather than stopped; it would block startup.
  rmSync(join(databaseDir, 'postmaster.pid'), { force: true });
  await pg.start();
  try {
    await pg.createDatabase('kenya_sme');
  } catch {
    // Already exists
  }
  console.log(`PostgreSQL started on localhost:${PORT} (database kenya_sme).`);
}

if (built && !existsSync(join(import.meta.dirname, '..', 'dist', 'main.js'))) {
  console.error('dist/main.js is missing: run `npm run build` first.');
  if (pg) await pg.stop().catch(() => {});
  process.exit(1);
}

const api = built
  ? spawn(process.execPath, ['--enable-source-maps', 'dist/main'], { stdio: 'inherit' })
  : spawn('npx', ['nest', 'start', '--watch'], { stdio: 'inherit', shell: true });

let stopping = false;
const shutdown = async (code = 0) => {
  if (stopping) return;
  stopping = true;
  api.kill();
  if (pg) await pg.stop().catch(() => {});
  process.exit(code);
};
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
api.on('exit', (code) => shutdown(code ?? 0));
