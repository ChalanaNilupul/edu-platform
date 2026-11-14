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
const studentA = randomUUID();
const studentB = randomUUID();
const guardianA = randomUUID();
const guardianB = randomUUID();
const linkA = randomUUID();
const linkB = randomUUID();
const membershipA1 = randomUUID();
const membershipA2 = randomUUID();
const membershipB1 = randomUUID();
const profileA = randomUUID();
const profileB = randomUUID();
const classA = randomUUID();
const classB = randomUUID();
const assignmentA = randomUUID();
const assignmentB = randomUUID();
const subjectA = randomUUID();
const subjectB = randomUUID();
const classSubjectA = randomUUID();
const classSubjectB = randomUUID();
const slotA = randomUUID();
const slotB = randomUUID();
const sessionA = randomUUID();
const sessionB = randomUUID();
const attendanceRecordA = randomUUID();
const attendanceRecordB = randomUUID();
const planA = randomUUID();
const planB = randomUUID();
const feeA = randomUUID();
const feeB = randomUUID();
const paymentA = randomUUID();
const paymentB = randomUUID();
const lessonA = randomUUID();
const lessonB = randomUUID();
const materialA = randomUUID();
const materialB = randomUUID();

async function seed() {
  await query(
    'TRUNCATE TABLE "lesson_materials", "lessons", "workspace_counters", "payments", "student_fees", "fee_plans", "attendance_records", "attendance_sessions", "class_schedule_slots", "class_subjects", "subjects", "class_teachers", "classes", "teacher_profiles", "student_guardians", "guardians", "students", "workspace_invitations", "memberships", "workspaces", "users" RESTART IDENTITY CASCADE',
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

  for (const [id, userId, workspaceId, role] of [
    [membershipA1, userA1, workspaceA, 'OWNER'],
    [membershipA2, userA2, workspaceA, 'TEACHER'],
    [membershipB1, userB1, workspaceB, 'OWNER'],
  ] as const) {
    await query(
      `INSERT INTO "memberships"
         ("id", "user_id", "workspace_id", "role", "status", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $5)`,
      [id, userId, workspaceId, role, now],
    );
  }

  await query(
    `INSERT INTO "teacher_profiles"
       ("id", "workspace_id", "membership_id", "qualifications", "specializations",
        "created_at", "updated_at")
     VALUES
       ($1, $2, $3, 'B.Sc. Mathematics', ARRAY['Mathematics'], $5, $5),
       ($4, $6, $7, 'B.A. English', ARRAY['English'], $5, $5)`,
    [profileA, workspaceA, membershipA2, profileB, now, workspaceB, membershipB1],
  );

  await query(
    `INSERT INTO "workspace_invitations"
       ("id", "workspace_id", "email", "role", "token_hash", "status", "invited_by_id",
        "expires_at", "created_at", "updated_at")
     VALUES
       ($1, $2, 'invited-a@example.com', 'TEACHER', 'hash-a', 'PENDING', $3, $5, $5, $5),
       ($4, $6, 'invited-b@example.com', 'TEACHER', 'hash-b', 'PENDING', $7, $5, $5, $5)`,
    [invitationA, workspaceA, userA1, invitationB, now, workspaceB, userB1],
  );

  await query(
    `INSERT INTO "students"
       ("id", "workspace_id", "first_name", "status", "created_at", "updated_at")
     VALUES
       ($1, $2, 'Alice', 'ACTIVE', $4, $4),
       ($3, $5, 'Bob', 'ACTIVE', $4, $4)`,
    [studentA, workspaceA, studentB, now, workspaceB],
  );

  await query(
    `INSERT INTO "guardians"
       ("id", "workspace_id", "first_name", "relationship", "created_at", "updated_at")
     VALUES
       ($1, $2, 'Sunil', 'FATHER', $4, $4),
       ($3, $5, 'Chamari', 'MOTHER', $4, $4)`,
    [guardianA, workspaceA, guardianB, now, workspaceB],
  );

  await query(
    `INSERT INTO "student_guardians"
       ("id", "workspace_id", "student_id", "guardian_id", "is_primary", "created_at", "updated_at")
     VALUES
       ($1, $2, $3, $4, true, $6, $6),
       ($5, $7, $8, $9, true, $6, $6)`,
    [linkA, workspaceA, studentA, guardianA, linkB, now, workspaceB, studentB, guardianB],
  );

  await query(
    `INSERT INTO "classes"
       ("id", "workspace_id", "name", "status", "created_at", "updated_at")
     VALUES
       ($1, $2, 'Class A', 'ACTIVE', $4, $4),
       ($3, $5, 'Class B', 'ACTIVE', $4, $4)`,
    [classA, workspaceA, classB, now, workspaceB],
  );

  await query(
    `INSERT INTO "class_teachers"
       ("id", "workspace_id", "class_id", "membership_id", "is_primary", "assigned_at",
        "created_at", "updated_at")
     VALUES
       ($1, $2, $3, $4, true, CURRENT_DATE, $6, $6),
       ($5, $7, $8, $9, true, CURRENT_DATE, $6, $6)`,
    [
      assignmentA,
      workspaceA,
      classA,
      membershipA2,
      assignmentB,
      now,
      workspaceB,
      classB,
      membershipB1,
    ],
  );

  await query(
    `INSERT INTO "subjects"
       ("id", "workspace_id", "name", "status", "created_at", "updated_at")
     VALUES
       ($1, $2, 'Mathematics', 'ACTIVE', $4, $4),
       ($3, $5, 'Science', 'ACTIVE', $4, $4)`,
    [subjectA, workspaceA, subjectB, now, workspaceB],
  );

  await query(
    `INSERT INTO "class_subjects"
       ("id", "workspace_id", "class_id", "subject_id", "created_at")
     VALUES
       ($1, $2, $3, $4, $6),
       ($5, $7, $8, $9, $6)`,
    [classSubjectA, workspaceA, classA, subjectA, classSubjectB, now, workspaceB, classB, subjectB],
  );

  await query(
    `INSERT INTO "class_schedule_slots"
       ("id", "workspace_id", "class_id", "subject_id", "membership_id", "day_of_week",
        "start_minutes", "end_minutes", "room", "created_at", "updated_at")
     VALUES
       ($1, $2, $3, $4, $5, 'MONDAY', 540, 600, 'Room A', $9, $9),
       ($6, $7, $8, $10, $11, 'TUESDAY', 540, 600, NULL, $9, $9)`,
    [
      slotA,
      workspaceA,
      classA,
      subjectA,
      membershipA2,
      slotB,
      workspaceB,
      classB,
      now,
      subjectB,
      membershipB1,
    ],
  );

  await query(
    `INSERT INTO "attendance_sessions"
       ("id", "workspace_id", "class_id", "session_date", "recorded_by_membership_id",
        "created_at", "updated_at")
     VALUES
       ($1, $2, $3, CURRENT_DATE, $4, $7, $7),
       ($5, $6, $8, CURRENT_DATE, $9, $7, $7)`,
    [sessionA, workspaceA, classA, membershipA2, sessionB, workspaceB, now, classB, membershipB1],
  );

  await query(
    `INSERT INTO "attendance_records"
       ("id", "workspace_id", "session_id", "student_id", "status", "created_at", "updated_at")
     VALUES
       ($1, $2, $3, $4, 'PRESENT', $6, $6),
       ($5, $7, $8, $9, 'ABSENT', $6, $6)`,
    [
      attendanceRecordA,
      workspaceA,
      sessionA,
      studentA,
      attendanceRecordB,
      now,
      workspaceB,
      sessionB,
      studentB,
    ],
  );

  await query(
    `INSERT INTO "fee_plans"
       ("id", "workspace_id", "class_id", "name", "amount", "billing_period", "due_day",
        "status", "created_at", "updated_at")
     VALUES
       ($1, $2, $3, 'Tuition A', 3500.00, 'MONTHLY', 5, 'ACTIVE', $6, $6),
       ($4, $5, $7, 'Tuition B', 2500.00, 'MONTHLY', 10, 'ACTIVE', $6, $6)`,
    [planA, workspaceA, classA, planB, workspaceB, now, classB],
  );

  await query(
    `INSERT INTO "student_fees"
       ("id", "workspace_id", "student_id", "fee_plan_id", "class_id", "description", "amount",
        "paid_amount", "status", "period_month", "due_date", "created_by_membership_id",
        "created_at", "updated_at")
     VALUES
       ($1, $2, $3, $4, $5, 'Tuition A — November 2026', 3500.00, 0, 'UNPAID', '2026-11-01',
        '2026-11-05', $6, $7, $7),
       ($8, $9, $10, $11, $12, 'Tuition B — November 2026', 2500.00, 0, 'UNPAID', '2026-11-01',
        '2026-11-10', $13, $7, $7)`,
    [
      feeA,
      workspaceA,
      studentA,
      planA,
      classA,
      membershipA2,
      now,
      feeB,
      workspaceB,
      studentB,
      planB,
      classB,
      membershipB1,
    ],
  );

  await query(
    `INSERT INTO "payments"
       ("id", "workspace_id", "student_fee_id", "receipt_number", "amount", "method", "paid_at",
        "recorded_by_membership_id", "created_at", "updated_at")
     VALUES
       ($1, $2, $3, 1, 1000.00, 'CASH', '2026-11-10', $5, $7, $7),
       ($4, $6, $8, 1, 500.00, 'BANK', '2026-11-11', $9, $7, $7)`,
    [paymentA, workspaceA, feeA, paymentB, membershipA2, workspaceB, now, feeB, membershipB1],
  );

  await query(
    `INSERT INTO "workspace_counters" ("workspace_id", "key", "value")
     VALUES ($1, 'payment_receipt', 1), ($2, 'payment_receipt', 1)`,
    [workspaceA, workspaceB],
  );

  await query(
    `INSERT INTO "lessons"
       ("id", "workspace_id", "class_id", "subject_id", "title", "lesson_date", "status",
        "created_by_membership_id", "created_at", "updated_at")
     VALUES
       ($1, $2, $3, $4, 'Fractions', CURRENT_DATE, 'PUBLISHED', $7, $8, $8),
       ($5, $6, $9, $10, 'Photosynthesis', CURRENT_DATE, 'DRAFT', $11, $8, $8)`,
    [
      lessonA,
      workspaceA,
      classA,
      subjectA,
      lessonB,
      workspaceB,
      membershipA2,
      now,
      classB,
      subjectB,
      membershipB1,
    ],
  );

  await query(
    `INSERT INTO "lesson_materials"
       ("id", "workspace_id", "lesson_id", "title", "kind", "url", "created_at", "updated_at")
     VALUES
       ($1, $2, $3, 'Fractions worksheet', 'PDF', 'https://example.com/fractions.pdf', $6, $6),
       ($4, $5, $7, 'Photosynthesis video', 'VIDEO', 'https://example.com/photosynthesis', $6, $6)`,
    [materialA, workspaceA, lessonA, materialB, workspaceB, now, lessonB],
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
      const students = await query('SELECT * FROM "students"');
      const guardians = await query('SELECT * FROM "guardians"');
      const links = await query('SELECT * FROM "student_guardians"');
      const profiles = await query('SELECT * FROM "teacher_profiles"');
      const classes = await query('SELECT * FROM "classes"');
      const assignments = await query('SELECT * FROM "class_teachers"');
      const subjects = await query('SELECT * FROM "subjects"');
      const classSubjects = await query('SELECT * FROM "class_subjects"');
      const slots = await query('SELECT * FROM "class_schedule_slots"');
      const sessions = await query('SELECT * FROM "attendance_sessions"');
      const attendanceRecords = await query('SELECT * FROM "attendance_records"');
      const plans = await query('SELECT * FROM "fee_plans"');
      const fees = await query('SELECT * FROM "student_fees"');
      const payments = await query('SELECT * FROM "payments"');
      const counters = await query('SELECT * FROM "workspace_counters"');
      const lessons = await query('SELECT * FROM "lessons"');
      const materials = await query('SELECT * FROM "lesson_materials"');

      expect(memberships.rowCount).toBe(0);
      expect(invitations.rowCount).toBe(0);
      expect(students.rowCount).toBe(0);
      expect(guardians.rowCount).toBe(0);
      expect(links.rowCount).toBe(0);
      expect(profiles.rowCount).toBe(0);
      expect(classes.rowCount).toBe(0);
      expect(assignments.rowCount).toBe(0);
      expect(subjects.rowCount).toBe(0);
      expect(classSubjects.rowCount).toBe(0);
      expect(slots.rowCount).toBe(0);
      expect(sessions.rowCount).toBe(0);
      expect(attendanceRecords.rowCount).toBe(0);
      expect(plans.rowCount).toBe(0);
      expect(fees.rowCount).toBe(0);
      expect(payments.rowCount).toBe(0);
      expect(counters.rowCount).toBe(0);
      expect(lessons.rowCount).toBe(0);
      expect(materials.rowCount).toBe(0);
    });
  });

  it('shows only the rows of the active workspace', async () => {
    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      const memberships = await query('SELECT "workspace_id" FROM "memberships"');
      const invitations = await query('SELECT "id", "workspace_id" FROM "workspace_invitations"');
      const students = await query('SELECT "id", "workspace_id" FROM "students"');
      const guardians = await query('SELECT "id", "workspace_id" FROM "guardians"');
      const links = await query('SELECT "id", "workspace_id" FROM "student_guardians"');
      const profiles = await query('SELECT "id", "workspace_id" FROM "teacher_profiles"');
      const classes = await query('SELECT "id", "workspace_id" FROM "classes"');
      const assignments = await query('SELECT "id", "workspace_id" FROM "class_teachers"');
      const subjects = await query('SELECT "id", "workspace_id" FROM "subjects"');
      const classSubjects = await query('SELECT "id", "workspace_id" FROM "class_subjects"');
      const slots = await query('SELECT "id", "workspace_id" FROM "class_schedule_slots"');
      const sessions = await query('SELECT "id", "workspace_id" FROM "attendance_sessions"');
      const attendanceRecords = await query(
        'SELECT "id", "workspace_id" FROM "attendance_records"',
      );
      const plans = await query('SELECT "id", "workspace_id" FROM "fee_plans"');
      const fees = await query('SELECT "id", "workspace_id" FROM "student_fees"');
      const payments = await query('SELECT "id", "workspace_id" FROM "payments"');
      const counters = await query('SELECT "workspace_id" FROM "workspace_counters"');
      const lessons = await query('SELECT "id", "workspace_id" FROM "lessons"');
      const materials = await query('SELECT "id", "workspace_id" FROM "lesson_materials"');

      expect(memberships.rowCount).toBe(2);
      expect(memberships.rows.every((row) => row.workspace_id === workspaceA)).toBe(true);
      expect(invitations.rows.map((row) => row.id)).toEqual([invitationA]);
      expect(students.rows.map((row) => row.id)).toEqual([studentA]);
      expect(guardians.rows.map((row) => row.id)).toEqual([guardianA]);
      expect(links.rows.map((row) => row.id)).toEqual([linkA]);
      expect(profiles.rows.map((row) => row.id)).toEqual([profileA]);
      expect(classes.rows.map((row) => row.id)).toEqual([classA]);
      expect(assignments.rows.map((row) => row.id)).toEqual([assignmentA]);
      expect(subjects.rows.map((row) => row.id)).toEqual([subjectA]);
      expect(classSubjects.rows.map((row) => row.id)).toEqual([classSubjectA]);
      expect(slots.rows.map((row) => row.id)).toEqual([slotA]);
      expect(sessions.rows.map((row) => row.id)).toEqual([sessionA]);
      expect(attendanceRecords.rows.map((row) => row.id)).toEqual([attendanceRecordA]);
      expect(plans.rows.map((row) => row.id)).toEqual([planA]);
      expect(fees.rows.map((row) => row.id)).toEqual([feeA]);
      expect(payments.rows.map((row) => row.id)).toEqual([paymentA]);
      expect(counters.rows).toEqual([{ workspace_id: workspaceA }]);
      expect(lessons.rows.map((row) => row.id)).toEqual([lessonA]);
      expect(materials.rows.map((row) => row.id)).toEqual([materialA]);
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

    // A failed statement aborts the transaction, so this needs its own block.
    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "students"
             ("id", "workspace_id", "first_name", "status", "created_at", "updated_at")
           VALUES ($1, $2, 'Intruder', 'ACTIVE', now(), now())`,
          [randomUUID(), workspaceB],
        ),
      ).rejects.toThrow(/row-level security policy/i);
    });

    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "guardians"
             ("id", "workspace_id", "first_name", "relationship", "created_at", "updated_at")
           VALUES ($1, $2, 'Intruder', 'OTHER', now(), now())`,
          [randomUUID(), workspaceB],
        ),
      ).rejects.toThrow(/row-level security policy/i);
    });

    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "student_guardians"
             ("id", "workspace_id", "student_id", "guardian_id", "is_primary",
              "created_at", "updated_at")
           VALUES ($1, $2, $3, $4, true, now(), now())`,
          [randomUUID(), workspaceB, studentA, guardianA],
        ),
      ).rejects.toThrow(/row-level security policy/i);
    });

    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "teacher_profiles"
             ("id", "workspace_id", "membership_id", "created_at", "updated_at")
           VALUES ($1, $2, $3, now(), now())`,
          [randomUUID(), workspaceB, membershipB1],
        ),
      ).rejects.toThrow(/row-level security policy/i);
    });

    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "class_teachers"
             ("id", "workspace_id", "class_id", "membership_id", "is_primary", "assigned_at",
              "created_at", "updated_at")
           VALUES ($1, $2, $3, $4, true, CURRENT_DATE, now(), now())`,
          [randomUUID(), workspaceB, classB, membershipB1],
        ),
      ).rejects.toThrow(/row-level security policy/i);
    });

    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "subjects"
             ("id", "workspace_id", "name", "status", "created_at", "updated_at")
           VALUES ($1, $2, 'Intruder', 'ACTIVE', now(), now())`,
          [randomUUID(), workspaceB],
        ),
      ).rejects.toThrow(/row-level security policy/i);
    });

    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "class_subjects"
             ("id", "workspace_id", "class_id", "subject_id", "created_at")
           VALUES ($1, $2, $3, $4, now())`,
          [randomUUID(), workspaceB, classB, subjectB],
        ),
      ).rejects.toThrow(/row-level security policy/i);
    });

    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "class_schedule_slots"
             ("id", "workspace_id", "class_id", "subject_id", "membership_id", "day_of_week",
              "start_minutes", "end_minutes", "room", "created_at", "updated_at")
           VALUES ($1, $2, $3, $4, $5, 'MONDAY', 540, 600, NULL, now(), now())`,
          [randomUUID(), workspaceB, classB, subjectB, membershipB1],
        ),
      ).rejects.toThrow(/row-level security policy/i);
    });

    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "attendance_sessions"
             ("id", "workspace_id", "class_id", "session_date", "recorded_by_membership_id",
              "created_at", "updated_at")
           VALUES ($1, $2, $3, CURRENT_DATE, $4, now(), now())`,
          [randomUUID(), workspaceB, classB, membershipB1],
        ),
      ).rejects.toThrow(/row-level security policy/i);
    });

    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "attendance_records"
             ("id", "workspace_id", "session_id", "student_id", "status", "created_at", "updated_at")
           VALUES ($1, $2, $3, $4, 'PRESENT', now(), now())`,
          [randomUUID(), workspaceB, sessionB, studentB],
        ),
      ).rejects.toThrow(/row-level security policy/i);
    });

    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "fee_plans"
             ("id", "workspace_id", "name", "amount", "billing_period", "due_day",
              "created_at", "updated_at")
           VALUES ($1, $2, 'Intruder', 100.00, 'MONTHLY', 5, now(), now())`,
          [randomUUID(), workspaceB],
        ),
      ).rejects.toThrow(/row-level security policy/i);
    });

    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "student_fees"
             ("id", "workspace_id", "student_id", "class_id", "description", "amount",
              "due_date", "created_at", "updated_at")
           VALUES ($1, $2, $3, $4, 'Intruder', 100.00, CURRENT_DATE, now(), now())`,
          [randomUUID(), workspaceB, studentB, classB],
        ),
      ).rejects.toThrow(/row-level security policy/i);
    });

    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "payments"
             ("id", "workspace_id", "student_fee_id", "receipt_number", "amount", "method", "paid_at",
              "created_at", "updated_at")
           VALUES ($1, $2, $3, 3, 100.00, 'CASH', CURRENT_DATE, now(), now())`,
          [randomUUID(), workspaceB, feeB],
        ),
      ).rejects.toThrow(/row-level security policy/i);
    });

    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "workspace_counters" ("workspace_id", "key", "value")
           VALUES ($1, 'payment_receipt', 5)`,
          [workspaceB],
        ),
      ).rejects.toThrow(/row-level security policy/i);
    });

    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "lessons"
             ("id", "workspace_id", "class_id", "title", "lesson_date", "status",
              "created_at", "updated_at")
           VALUES ($1, $2, $3, 'Intruder', CURRENT_DATE, 'DRAFT', now(), now())`,
          [randomUUID(), workspaceB, classB],
        ),
      ).rejects.toThrow(/row-level security policy/i);
    });

    await asRestrictedRole(async () => {
      await setConfig('app.workspace_id', workspaceA);

      await expect(
        query(
          `INSERT INTO "lesson_materials"
             ("id", "workspace_id", "lesson_id", "title", "kind", "url", "created_at", "updated_at")
           VALUES ($1, $2, $3, 'Intruder', 'LINK', 'https://example.com', now(), now())`,
          [randomUUID(), workspaceB, lessonB],
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
      const updateGuardians = await query(
        `UPDATE "guardians" SET "occupation" = 'Intruder' WHERE "workspace_id" = $1`,
        [workspaceB],
      );
      const removeLinks = await query(`DELETE FROM "student_guardians" WHERE "id" = $1`, [linkB]);
      const updateProfiles = await query(
        `UPDATE "teacher_profiles" SET "qualifications" = 'Intruder' WHERE "workspace_id" = $1`,
        [workspaceB],
      );
      const removeProfiles = await query(`DELETE FROM "teacher_profiles" WHERE "id" = $1`, [
        profileB,
      ]);
      const updateClasses = await query(
        `UPDATE "classes" SET "name" = 'Intruder' WHERE "workspace_id" = $1`,
        [workspaceB],
      );
      const removeAssignments = await query(`DELETE FROM "class_teachers" WHERE "id" = $1`, [
        assignmentB,
      ]);
      const updateSubjects = await query(
        `UPDATE "subjects" SET "name" = 'Intruder' WHERE "workspace_id" = $1`,
        [workspaceB],
      );
      const removeClassSubjects = await query(`DELETE FROM "class_subjects" WHERE "id" = $1`, [
        classSubjectB,
      ]);
      const updateSlots = await query(
        `UPDATE "class_schedule_slots" SET "room" = 'Intruder' WHERE "workspace_id" = $1`,
        [workspaceB],
      );
      const removeSlots = await query(`DELETE FROM "class_schedule_slots" WHERE "id" = $1`, [
        slotB,
      ]);
      const updateSessions = await query(
        `UPDATE "attendance_sessions" SET "recorded_by_membership_id" = NULL WHERE "workspace_id" = $1`,
        [workspaceB],
      );
      const removeSessions = await query(`DELETE FROM "attendance_sessions" WHERE "id" = $1`, [
        sessionB,
      ]);
      const updateRecords = await query(
        `UPDATE "attendance_records" SET "status" = 'EXCUSED' WHERE "workspace_id" = $1`,
        [workspaceB],
      );
      const removeRecords = await query(`DELETE FROM "attendance_records" WHERE "id" = $1`, [
        attendanceRecordB,
      ]);
      const updatePlans = await query(
        `UPDATE "fee_plans" SET "name" = 'Intruder' WHERE "workspace_id" = $1`,
        [workspaceB],
      );
      const removePlans = await query(`DELETE FROM "fee_plans" WHERE "id" = $1`, [planB]);
      const updateFees = await query(
        `UPDATE "student_fees" SET "description" = 'Intruder' WHERE "workspace_id" = $1`,
        [workspaceB],
      );
      const removeFees = await query(`DELETE FROM "student_fees" WHERE "id" = $1`, [feeB]);
      const updatePayments = await query(
        `UPDATE "payments" SET "reference" = 'Intruder' WHERE "workspace_id" = $1`,
        [workspaceB],
      );
      const removePayments = await query(`DELETE FROM "payments" WHERE "id" = $1`, [paymentB]);
      const updateLessons = await query(
        `UPDATE "lessons" SET "title" = 'Intruder' WHERE "workspace_id" = $1`,
        [workspaceB],
      );
      const removeLessons = await query(`DELETE FROM "lessons" WHERE "id" = $1`, [lessonB]);
      const updateMaterials = await query(
        `UPDATE "lesson_materials" SET "title" = 'Intruder' WHERE "workspace_id" = $1`,
        [workspaceB],
      );
      const removeMaterials = await query(`DELETE FROM "lesson_materials" WHERE "id" = $1`, [
        materialB,
      ]);

      expect(update.rowCount).toBe(0);
      expect(remove.rowCount).toBe(0);
      expect(updateGuardians.rowCount).toBe(0);
      expect(removeLinks.rowCount).toBe(0);
      expect(updateProfiles.rowCount).toBe(0);
      expect(removeProfiles.rowCount).toBe(0);
      expect(updateClasses.rowCount).toBe(0);
      expect(removeAssignments.rowCount).toBe(0);
      expect(updateSubjects.rowCount).toBe(0);
      expect(removeClassSubjects.rowCount).toBe(0);
      expect(updateSlots.rowCount).toBe(0);
      expect(removeSlots.rowCount).toBe(0);
      expect(updateSessions.rowCount).toBe(0);
      expect(removeSessions.rowCount).toBe(0);
      expect(updateRecords.rowCount).toBe(0);
      expect(removeRecords.rowCount).toBe(0);
      expect(updatePlans.rowCount).toBe(0);
      expect(removePlans.rowCount).toBe(0);
      expect(updateFees.rowCount).toBe(0);
      expect(removeFees.rowCount).toBe(0);
      expect(updatePayments.rowCount).toBe(0);
      expect(removePayments.rowCount).toBe(0);
      expect(updateLessons.rowCount).toBe(0);
      expect(removeLessons.rowCount).toBe(0);
      expect(updateMaterials.rowCount).toBe(0);
      expect(removeMaterials.rowCount).toBe(0);
    });
  });

  it('lets the system path see every tenant row', async () => {
    await asRestrictedRole(async () => {
      await setConfig('app.bypass_rls', 'on');

      const memberships = await query('SELECT "id" FROM "memberships"');
      const invitations = await query('SELECT "id" FROM "workspace_invitations"');
      const students = await query('SELECT "id" FROM "students"');
      const guardians = await query('SELECT "id" FROM "guardians"');
      const links = await query('SELECT "id" FROM "student_guardians"');
      const profiles = await query('SELECT "id" FROM "teacher_profiles"');
      const classes = await query('SELECT "id" FROM "classes"');
      const assignments = await query('SELECT "id" FROM "class_teachers"');
      const subjects = await query('SELECT "id" FROM "subjects"');
      const classSubjects = await query('SELECT "id" FROM "class_subjects"');
      const slots = await query('SELECT "id" FROM "class_schedule_slots"');
      const sessions = await query('SELECT "id" FROM "attendance_sessions"');
      const attendanceRecords = await query('SELECT "id" FROM "attendance_records"');
      const plans = await query('SELECT "id" FROM "fee_plans"');
      const fees = await query('SELECT "id" FROM "student_fees"');
      const payments = await query('SELECT "id" FROM "payments"');
      const counters = await query('SELECT "workspace_id" FROM "workspace_counters"');
      const lessons = await query('SELECT "id" FROM "lessons"');
      const materials = await query('SELECT "id" FROM "lesson_materials"');

      expect(memberships.rowCount).toBe(3);
      expect(invitations.rowCount).toBe(2);
      expect(students.rowCount).toBe(2);
      expect(guardians.rowCount).toBe(2);
      expect(links.rowCount).toBe(2);
      expect(profiles.rowCount).toBe(2);
      expect(classes.rowCount).toBe(2);
      expect(assignments.rowCount).toBe(2);
      expect(subjects.rowCount).toBe(2);
      expect(classSubjects.rowCount).toBe(2);
      expect(slots.rowCount).toBe(2);
      expect(sessions.rowCount).toBe(2);
      expect(attendanceRecords.rowCount).toBe(2);
      expect(plans.rowCount).toBe(2);
      expect(fees.rowCount).toBe(2);
      expect(payments.rowCount).toBe(2);
      expect(counters.rowCount).toBe(2);
      expect(lessons.rowCount).toBe(2);
      expect(materials.rowCount).toBe(2);
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
