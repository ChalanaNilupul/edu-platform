import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resolveTestDatabaseUrl } from './database-url.js';

// The development database role owns the tables and is a superuser, so RLS is
// bypassed for it. Policies are exercised through a restricted role to prove
// they behave as intended when the app connects as a non-superuser.
const RESTRICTED_ROLE = 'edu_rls_test';

type Row = Record<string, unknown>;

const client = new Client({ connectionString: resolveTestDatabaseUrl() });

async function query(text: string, values: unknown[] = []) {
  const result = await client.query(text, values as never[]);
  return { rows: result.rows as Row[], rowCount: result.rowCount ?? 0 };
}

async function ensureRestrictedRole() {
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RESTRICTED_ROLE}') THEN
        CREATE ROLE ${RESTRICTED_ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS;
      END IF;
    END
    $$;
  `);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${RESTRICTED_ROLE}`);
  await client.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${RESTRICTED_ROLE}`,
  );
  await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${RESTRICTED_ROLE}`);
}

// Runs the callback inside a transaction with the restricted role active. RLS
// only applies to non-superusers, so the role switch is the point of the test.
async function asRestrictedRole<T>(fn: () => Promise<T>): Promise<T> {
  await client.query('BEGIN');
  try {
    await client.query(`SET LOCAL ROLE ${RESTRICTED_ROLE}`);
    return await fn();
  } finally {
    await client.query('ROLLBACK');
  }
}

async function setConfig(key: string, value: string) {
  await client.query(`SELECT set_config($1, $2, true)`, [key, value]);
}

const workspaceA = randomUUID();
const workspaceB = randomUUID();
const userA1 = randomUUID();
const userA2 = randomUUID();
const userB1 = randomUUID();
const invitationA = randomUUID();
const invitationB = randomUUID();

async function seed() {
  await query(
    'TRUNCATE TABLE "workspace_invitations", "memberships", "workspaces", "users" RESTART IDENTITY CASCADE',
  );

  const now = new Date().toISOString();
  const passwordHash = 'not-used-in-this-test';

  for (const [id, email] of [
    [userA1, 'owner-a@example.com'],
    [userA2, 'teacher-a@example.com'],
    [userB1, 'owner-b@example.com'],
  ] as const) {
    await query(
      `INSERT INTO "users" ("id", "email", "password_hash", "first_name", "created_at", "updated_at")
       VALUES ($1, $2, $3, 'Test', $4, $4)`,
      [id, email, passwordHash, now],
    );
  }

  for (const [id, name] of [
    [workspaceA, 'Workspace A'],
    [workspaceB, 'Workspace B'],
  ] as const) {
    await query(
      `INSERT INTO "workspaces" ("id", "name", "type", "created_at", "updated_at")
       VALUES ($1, $2, 'TEACHER', $3, $3)`,
      [id, name, now],
    );
  }

  for (const [userId, workspaceId, role] of [
    [userA1, workspaceA, 'OWNER'],
    [userA2, workspaceA, 'TEACHER'],
    [userB1, workspaceB, 'OWNER'],
  ] as const) {
    await query(
      `INSERT INTO "memberships"
         ("id", "user_id", "workspace_id", "role", "status", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $5)`,
      [randomUUID(), userId, workspaceId, role, now],
    );
  }

  await query(
    `INSERT INTO "workspace_invitations"
       ("id", "workspace_id", "email", "role", "token_hash", "status", "invited_by_id",
        "expires_at", "created_at", "updated_at")
     VALUES
       ($1, $2, 'invited-a@example.com', 'TEACHER', 'hash-a', 'PENDING', $3, $5, $5, $5),
       ($4, $6, 'invited-b@example.com', 'TEACHER', 'hash-b', 'PENDING', $7, $5, $5, $5)`,
    [invitationA, workspaceA, userA1, invitationB, now, workspaceB, userB1],
  );
}

beforeAll(async () => {
  await client.connect();
});

beforeEach(async () => {
  await ensureRestrictedRole();
  await seed();
});

afterAll(async () => {
  await client.end();
});

describe('Row level security on tenant tables', () => {
  it('hides every row when no tenant or user context is set', async () => {
    await asRestrictedRole(async () => {
      const memberships = await query('SELECT * FROM "memberships"');
      const invitations = await query('SELECT * FROM "workspace_invitations"');

      expect(memberships.rowCount).toBe(0);
      expect(invitations.rowCount).toBe(0);
    });
  });

  it('shows only the rows of the active workspace', async () => {
    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      const memberships = await query('SELECT "workspace_id" FROM "memberships"');
      const invitations = await query('SELECT "id", "workspace_id" FROM "workspace_invitations"');

      expect(memberships.rowCount).toBe(2);
      expect(memberships.rows.every((row) => row.workspace_id === workspaceA)).toBe(true);
      expect(invitations.rows.map((row) => row.id)).toEqual([invitationA]);
    });
  });

  it('shows only the user memberships under a user context', async () => {
    await asRestrictedRole(async () => {
      await setConfig('app.user_id', userA2);

      const memberships = await query('SELECT "user_id", "workspace_id" FROM "memberships"');

      expect(memberships.rows).toEqual([{ user_id: userA2, workspace_id: workspaceA }]);
    });
  });

  it('rejects writes that target another workspace', async () => {
    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "memberships"
             ("id", "user_id", "workspace_id", "role", "status", "created_at", "updated_at")
           VALUES ($1, $2, $3, 'TEACHER', 'ACTIVE', now(), now())`,
          [randomUUID(), userB1, workspaceB],
        ),
      ).rejects.toThrow(/row-level security policy/i);
    });
  });

  it('cannot update or delete another tenant rows', async () => {
    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      const update = await query(
        `UPDATE "memberships" SET "role" = 'ADMIN' WHERE "workspace_id" = $1`,
        [workspaceB],
      );
      const remove = await query(`DELETE FROM "workspace_invitations" WHERE "id" = $1`, [
        invitationB,
      ]);

      expect(update.rowCount).toBe(0);
      expect(remove.rowCount).toBe(0);
    });
  });

  it('lets the system path see every tenant row', async () => {
    await asRestrictedRole(async () => {
      await setConfig('app.bypass_rls', 'on');

      const memberships = await query('SELECT "id" FROM "memberships"');
      const invitations = await query('SELECT "id" FROM "workspace_invitations"');

      expect(memberships.rowCount).toBe(3);
      expect(invitations.rowCount).toBe(2);
    });
  });

  it('does not leak the tenant context between transactions', async () => {
    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);
      const inside = await query('SELECT "id" FROM "memberships"');
      expect(inside.rowCount).toBe(2);
    });

    await asRestrictedRole(async () => {
      const outside = await query('SELECT "id" FROM "memberships"');
      expect(outside.rowCount).toBe(0);
    });
  });
});
