import 'dotenv/config';
import { Client } from 'pg';

const adminUrl = process.env.DATABASE_URL;
const appUrl = process.env.DATABASE_APP_URL;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!adminUrl) {
  fail('DATABASE_URL (admin/owner connection) is required.');
}

if (!appUrl) {
  fail('DATABASE_APP_URL (restricted application connection) is required.');
}

const admin = new URL(adminUrl);
const application = new URL(appUrl);

const role = decodeURIComponent(application.username);
const password = decodeURIComponent(application.password);
const database = decodeURIComponent(application.pathname.slice(1));

if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(role)) {
  fail(`Unsupported role name: ${role}`);
}

if (!database) {
  fail('DATABASE_APP_URL must include a database name.');
}

if (!password) {
  fail('DATABASE_APP_URL must include a password for the application role.');
}

if (role === decodeURIComponent(admin.username)) {
  fail('DATABASE_APP_URL must use a different role than DATABASE_URL.');
}

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const quoteLiteral = (value) => `'${value.replaceAll("'", "''")}'`;

const client = new Client({ connectionString: adminUrl });

await client.connect();

try {
  const roleIdentifier = quoteIdentifier(role);
  const existing = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);

  await client.query('BEGIN');

  if (existing.rowCount === 0) {
    await client.query(
      `CREATE ROLE ${roleIdentifier} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
    );
  } else {
    await client.query(
      `ALTER ROLE ${roleIdentifier} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
    );
  }

  await client.query(`ALTER ROLE ${roleIdentifier} PASSWORD ${quoteLiteral(password)}`);

  await client.query(`GRANT CONNECT ON DATABASE ${quoteIdentifier(database)} TO ${roleIdentifier}`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${roleIdentifier}`);
  await client.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${roleIdentifier}`,
  );
  await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${roleIdentifier}`);
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${roleIdentifier}`,
  );
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${roleIdentifier}`,
  );

  const migrationsTable = await client.query(
    "SELECT to_regclass('public._prisma_migrations') AS name",
  );

  if (migrationsTable.rows[0]?.name) {
    await client.query(`REVOKE ALL ON TABLE public._prisma_migrations FROM ${roleIdentifier}`);
  }

  await client.query('COMMIT');

  console.log(`Application role "${role}" is ready for database "${database}".`);
  console.log('Set DATABASE_APP_URL in your environment to use it at runtime.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
