import 'dotenv/config';
import { execFileSync, execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function step(label, run) {
  console.log(`\n> ${label}`);

  try {
    run();
  } catch (error) {
    console.error(`\nFailed: ${label}`);
    process.exit(typeof error.status === 'number' ? error.status : 1);
  }
}

step('prisma generate', () =>
  execSync('pnpm exec prisma generate', { cwd: apiRoot, stdio: 'inherit' }),
);

step('prisma migrate deploy', () =>
  execSync('pnpm exec prisma migrate deploy', { cwd: apiRoot, stdio: 'inherit' }),
);

// Setup needs a second connection string and only matters when the runtime role
// is in use, so a plain DATABASE_URL setup stays a valid development path.
if (!process.env.DATABASE_APP_URL) {
  console.log('\nDATABASE_APP_URL is not set; skipping application role setup.');
  process.exit(0);
}

step('setup application role', () =>
  execFileSync(process.execPath, ['scripts/setup-app-role.mjs'], {
    cwd: apiRoot,
    stdio: 'inherit',
  }),
);
