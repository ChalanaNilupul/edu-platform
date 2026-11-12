import 'dotenv/config';

const TEST_DATABASE_NAME = 'edu_platform_test';

export function resolveTestDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;

  if (explicit) {
    return explicit;
  }

  const base = process.env.DATABASE_URL;

  if (!base) {
    throw new Error('Set TEST_DATABASE_URL or DATABASE_URL before running integration tests');
  }

  const url = new URL(base);
  url.pathname = `/${TEST_DATABASE_NAME}`;

  return url.toString();
}
