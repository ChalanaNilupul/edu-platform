import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

import { resolveTestDatabaseUrl } from './database-url.js';

export default async function setup() {
  const testUrl = new URL(resolveTestDatabaseUrl());
  const databaseName = decodeURIComponent(testUrl.pathname.slice(1));

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';

  const client = new Client({ connectionString: adminUrl.toString() });

  await client.connect();

  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      databaseName,
    ]);

    if (!rowCount) {
      await client.query(`CREATE DATABASE "${databaseName.replaceAll('"', '""')}"`);
    }
  } finally {
    await client.end();
  }

  const apiRoot = fileURLToPath(new URL('../..', import.meta.url));

  execSync('pnpm exec prisma migrate deploy', {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    stdio: 'inherit',
  });
}
