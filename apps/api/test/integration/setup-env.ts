import { resolveTestDatabaseUrl } from './database-url.js';

process.env.DATABASE_URL = resolveTestDatabaseUrl();
// Keep the runtime connection on the test database; a developer .env may point it elsewhere.
process.env.DATABASE_APP_URL = process.env.DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';
