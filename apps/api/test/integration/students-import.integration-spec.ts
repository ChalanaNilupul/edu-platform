import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createTestContext,
  createWorkspace,
  post,
  registerAndLogin,
  registerVerifiedUser,
  truncateAll,
  verifyEmail,
} from './helpers.js';
import type { TestContext } from './helpers.js';

type StudentListResponse = {
  total: number;
};

describe('Student import integration', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
  });

  beforeEach(async () => {
    await truncateAll(context.prisma);
    context.mail.verifications.length = 0;
    context.mail.passwordResets.length = 0;
    context.mail.invitations.length = 0;
  });

  afterAll(async () => {
    await context.app.close();
  });

  const mixedCsv = [
    'student_code,first_name,last_name,email,date_of_birth,grade,status',
    'STU-001,Nimal,Perera,NIMAL@EXAMPLE.COM,2010-05-14,Grade 8,ACTIVE',
    'STU-001,Kamal,Silva,kamal@example.com,,Grade 9,',
    'STU-003,Nimali,"Fernando, Jr.",,,Grade 10,GRADUATED',
  ].join('\n');

  async function addTeacher(
    ownerClient: Awaited<ReturnType<typeof registerAndLogin>>['client'],
    workspaceId: string,
    email: string,
  ) {
    const teacher = await registerAndLogin(context, email);

    await verifyEmail(context, teacher.client, email);

    const invitation = await post(ownerClient, `/workspaces/${workspaceId}/invitations`).send({
      email,
      role: 'TEACHER',
    });

    expect(invitation.status).toBe(201);

    const accepted = await post(teacher.client, '/invitations/accept').send({
      token: context.mail.invitations.at(-1)!.token,
    });

    expect(accepted.status).toBe(200);

    return teacher;
  }

  it('validates, imports and reports duplicates without touching existing students', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');

    const validation = await post(
      owner.client,
      `/workspaces/${workspace.id}/students/import/validate`,
    ).send({ csv: mixedCsv });

    expect(validation.status).toBe(200);
    expect(validation.body).toMatchObject({
      totalRows: 3,
      validRows: 2,
      invalidRows: 0,
      duplicateRows: 1,
    });
    expect(validation.body.rows[1]).toMatchObject({
      line: 3,
      studentCode: 'STU-001',
      firstName: 'Kamal',
      status: 'DUPLICATE',
    });

    const imported = await post(owner.client, `/workspaces/${workspace.id}/students/import`).send({
      csv: mixedCsv,
    });

    expect(imported.status).toBe(200);
    expect(imported.body).toEqual({
      imported: 2,
      skipped: 1,
      duplicates: [{ line: 3, studentCode: 'STU-001', reason: 'IN_FILE' }],
    });

    const directory = await owner.client.get(`/api/v1/workspaces/${workspace.id}/students`);
    const items = directory.body.items as {
      id: string;
      studentCode: string | null;
      firstName: string;
      lastName: string | null;
      grade: string | null;
    }[];

    expect(items.find((student) => student.grade === 'Grade 8')?.studentCode).toBe('STU-001');
    expect(items.find((student) => student.grade === 'Grade 10')?.lastName).toBe('Fernando, Jr.');

    const nimal = items.find((student) => student.grade === 'Grade 8');

    const detail = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/students/${nimal!.id}`,
    );

    expect(detail.body).toMatchObject({
      firstName: 'Nimal',
      email: 'nimal@example.com',
      dateOfBirth: '2010-05-14T00:00:00.000Z',
      status: 'ACTIVE',
    });

    const auditEvents = await context.prisma.auditEvent.findMany({
      where: { type: 'STUDENTS_IMPORTED', workspaceId: workspace.id },
    });

    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]?.metadata).toEqual({ imported: 2, skipped: 1 });

    const again = await post(owner.client, `/workspaces/${workspace.id}/students/import`).send({
      csv: ['first_name,student_code', 'Changed Name,STU-001', 'Someone,STU-003'].join('\n'),
    });

    expect(again.status).toBe(200);
    expect(again.body.imported).toBe(0);
    expect(again.body.skipped).toBe(2);
    expect(again.body.duplicates).toEqual([
      { line: 2, studentCode: 'STU-001', reason: 'EXISTING' },
      { line: 3, studentCode: 'STU-003', reason: 'EXISTING' },
    ]);

    const after = await owner.client.get(`/api/v1/workspaces/${workspace.id}/students`);
    const names = (after.body.items as { firstName: string }[]).map((student) => student.firstName);

    expect(after.body.total).toBe(2);
    expect(names).not.toContain('Changed Name');
  });

  it('blocks the import while any row is invalid', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute');

    const csv = ['first_name,email', 'Nimal,not-an-email'].join('\n');

    const validation = await post(
      owner.client,
      `/workspaces/${workspace.id}/students/import/validate`,
    ).send({ csv });

    expect(validation.status).toBe(200);
    expect(validation.body.invalidRows).toBe(1);
    expect(validation.body.rows[0].errors.join(' ')).toContain('email must be an email');

    const imported = await post(owner.client, `/workspaces/${workspace.id}/students/import`).send({
      csv,
    });

    expect(imported.status).toBe(400);
    expect(imported.body.message).toBe('Fix 1 invalid row before importing');
    expect(imported.body.invalidRows).toHaveLength(1);

    const directory = await owner.client.get(`/api/v1/workspaces/${workspace.id}/students`);

    expect((directory.body as StudentListResponse).total).toBe(0);
    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'STUDENTS_IMPORTED', workspaceId: workspace.id },
      }),
    ).toBe(0);
  });

  it('keeps imports scoped to the workspace', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const first = await createWorkspace(owner.client, 'First');
    const second = await createWorkspace(owner.client, 'Second');

    const created = await post(owner.client, `/workspaces/${first.id}/students`).send({
      firstName: 'Nimal',
      studentCode: 'STU-001',
    });

    expect(created.status).toBe(201);

    const imported = await post(owner.client, `/workspaces/${second.id}/students/import`).send({
      csv: 'first_name,student_code\nKamal,STU-001\n',
    });

    expect(imported.status).toBe(200);
    expect(imported.body).toMatchObject({ imported: 1, skipped: 0 });

    const firstDirectory = await owner.client.get(`/api/v1/workspaces/${first.id}/students`);
    const secondDirectory = await owner.client.get(`/api/v1/workspaces/${second.id}/students`);

    expect((firstDirectory.body as StudentListResponse).total).toBe(1);
    expect((secondDirectory.body as StudentListResponse).total).toBe(1);
  });

  it('rejects malformed CSV structure with a clear error', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute');

    const unknownColumn = await post(
      owner.client,
      `/workspaces/${workspace.id}/students/import/validate`,
    ).send({ csv: 'first_name,nickname\nNimal,Nim\n' });

    expect(unknownColumn.status).toBe(400);
    expect(unknownColumn.body.message).toContain('Unsupported column: nickname');

    const missingName = await post(
      owner.client,
      `/workspaces/${workspace.id}/students/import/validate`,
    ).send({ csv: 'last_name\nPerera\n' });

    expect(missingName.status).toBe(400);
    expect(missingName.body.message).toBe('The header row must include a first_name column');
  });

  it('forbids teachers from importing', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const teacher = await addTeacher(owner.client, workspace.id, 'teacher@example.com');

    for (const path of ['import/validate', 'import']) {
      const response = await post(
        teacher.client,
        `/workspaces/${workspace.id}/students/${path}`,
      ).send({ csv: 'first_name\nNimal\n' });

      expect(response.status).toBe(403);
    }

    const directory = await owner.client.get(`/api/v1/workspaces/${workspace.id}/students`);

    expect((directory.body as StudentListResponse).total).toBe(0);
  });

  it('rejects outsiders and unauthenticated callers', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute');
    const outsider = await registerAndLogin(context, 'outsider@example.com');

    const outsiderImport = await post(
      outsider.client,
      `/workspaces/${workspace.id}/students/import`,
    ).send({ csv: 'first_name\nIntruder\n' });

    expect(outsiderImport.status).toBe(403);

    const anonymous = await request(context.app.getHttpServer())
      .post(`/api/v1/workspaces/${workspace.id}/students/import/validate`)
      .send({ csv: 'first_name\nNimal\n' });

    expect(anonymous.status).toBe(401);
  });
});
