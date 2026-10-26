// `npm run start:dev`: starts the local PostgreSQL (unless one is already
// listening on 5432), then runs the API in watch mode. Ctrl+C stops both.
import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';

const PORT = 5432;
const databaseDir = join(import.meta.dirname, '..', 'data', 'pg');

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
  await pg.start();
  try {
    await pg.createDatabase('kenya_sme');
  } catch {
    // Already exists
  }
  console.log(`PostgreSQL started on localhost:${PORT} (database kenya_sme).`);
}

const nest = spawn('npx', ['nest', 'start', '--watch'], { stdio: 'inherit', shell: true });

let stopping = false;
const shutdown = async (code = 0) => {
  if (stopping) return;
  stopping = true;
  nest.kill();
  if (pg) await pg.stop().catch(() => {});
  process.exit(code);
};
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
nest.on('exit', (code) => shutdown(code ?? 0));
