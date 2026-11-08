import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(args) {
  const result = spawnSync(pnpm, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.VERCEL_ENV === 'production') {
  if (!process.env.DIRECT_DATABASE_URL) {
    throw new Error('DIRECT_DATABASE_URL is required for production migrations.');
  }

  console.info('Applying pending production database migrations.');
  run(['--filter', '@mudra/database', 'db:migrate:deploy']);
  console.info('Production database migrations completed.');
}

run(['--filter', '@mudra/web...', 'build']);
