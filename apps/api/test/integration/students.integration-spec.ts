import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createTestContext,
  createWorkspace,
  patch,
  post,
  registerAndLogin,
  registerVerifiedUser,
  truncateAll,
  verifyEmail,
} from './helpers.js';
import type { createAgent, TestContext } from './helpers.js';

type StudentResponse = {
  id: string;
  studentCode: string | null;
  firstName: string;
  lastName: string | null;
  status: string;
  email: string | null;
};

describe('Student management integration', () => {
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

  async function createStudent(
    client: ReturnType<typeof createAgent>,
    workspaceId: string,
    body: Record<string, unknown>,
  ) {
    const response = await post(client, `/workspaces/${workspaceId}/students`).send(body);

    expect(response.status).toBe(201);

    return response.body as StudentResponse;
  }

  async function addTeacher(
    ownerClient: ReturnType<typeof createAgent>,
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

  it('creates students and lists them with search, filtering and pagination', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');

    const nimal = await createStudent(owner.client, workspace.id, {
      studentCode: 'STU-001',
      firstName: 'Nimal',
      lastName: 'Perera',
      email: 'NIMAL@EXAMPLE.COM',
      phone: '+94770000001',
      grade: 'Grade 8',
      dateOfBirth: '2010-05-14',
    });

    expect(nimal.email).toBe('nimal@example.com');

    await createStudent(owner.client, workspace.id, {
      studentCode: 'STU-002',
      firstName: 'Kamala',
      lastName: 'Silva',
      grade: 'Grade 9',
    });

    const inactive = await createStudent(owner.client, workspace.id, {
      studentCode: 'STU-003',
      firstName: 'Nimali',
      lastName: 'Fernando',
      grade: 'Grade 10',
    });

    const withdrawn = await patch(
      owner.client,
      `/workspaces/${workspace.id}/students/${inactive.id}`,
    ).send({ status: 'WITHDRAWN' });

    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.status).toBe('WITHDRAWN');

    const search = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/students?search=nimal`,
    );

    expect(search.status).toBe(200);
    expect(search.body.items.map((item: StudentResponse) => item.firstName)).toEqual([
      'Nimal',
      'Nimali',
    ]);

    const active = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/students?status=ACTIVE&page=1&pageSize=2`,
    );

    expect(active.status).toBe(200);
    expect(active.body.total).toBe(2);
    expect(active.body.totalPages).toBe(1);
    expect(active.body.items).toHaveLength(2);

    const page = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/students?page=2&pageSize=2`,
    );

    expect(page.status).toBe(200);
    expect(page.body.total).toBe(3);
    expect(page.body.totalPages).toBe(2);
    expect(page.body.items).toHaveLength(1);

    const detail = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/students/${nimal.id}`,
    );

    expect(detail.status).toBe(200);
    expect(detail.body.studentCode).toBe('STU-001');
    expect(detail.body.dateOfBirth).toBe('2010-05-14T00:00:00.000Z');

    const created = await context.prisma.auditEvent.count({
      where: { type: 'STUDENT_CREATED', workspaceId: workspace.id },
    });

    expect(created).toBe(3);
  });

  it('rejects duplicate student codes and invalid student data', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute');

    await createStudent(owner.client, workspace.id, {
      studentCode: 'STU-001',
      firstName: 'Nimal',
    });

    const duplicate = await post(owner.client, `/workspaces/${workspace.id}/students`).send({
      studentCode: 'STU-001',
      firstName: 'Another',
    });

    expect(duplicate.status).toBe(409);

    const missingName = await post(owner.client, `/workspaces/${workspace.id}/students`).send({
      studentCode: 'STU-002',
    });

    expect(missingName.status).toBe(400);

    const badEmail = await post(owner.client, `/workspaces/${workspace.id}/students`).send({
      firstName: 'Kamala',
      email: 'not-an-email',
    });

    expect(badEmail.status).toBe(400);
  });

  it('lets teachers read students but not change them', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const teacher = await addTeacher(owner.client, workspace.id, 'teacher@example.com');

    const student = await createStudent(owner.client, workspace.id, {
      firstName: 'Nimal',
      grade: 'Grade 8',
    });

    const list = await teacher.client.get(`/api/v1/workspaces/${workspace.id}/students`);

    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);

    const detail = await teacher.client.get(
      `/api/v1/workspaces/${workspace.id}/students/${student.id}`,
    );

    expect(detail.status).toBe(200);

    const created = await post(teacher.client, `/workspaces/${workspace.id}/students`).send({
      firstName: 'Kamala',
    });

    expect(created.status).toBe(403);

    const updated = await patch(
      teacher.client,
      `/workspaces/${workspace.id}/students/${student.id}`,
    ).send({ grade: 'Grade 9' });

    expect(updated.status).toBe(403);
  });

  it('isolates student records between workspaces and from outsiders', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const first = await createWorkspace(owner.client, 'First');
    const second = await createWorkspace(owner.client, 'Second');
    const outsider = await registerAndLogin(context, 'outsider@example.com');

    const student = await createStudent(owner.client, first.id, {
      firstName: 'Nimal',
      studentCode: 'STU-001',
    });

    const secondDirectory = await owner.client.get(`/api/v1/workspaces/${second.id}/students`);

    expect(secondDirectory.status).toBe(200);
    expect(secondDirectory.body.total).toBe(0);

    const crossWorkspaceDetail = await owner.client.get(
      `/api/v1/workspaces/${second.id}/students/${student.id}`,
    );

    expect(crossWorkspaceDetail.status).toBe(404);

    const outsiderList = await outsider.client.get(`/api/v1/workspaces/${first.id}/students`);

    expect(outsiderList.status).toBe(403);

    const outsiderDetail = await outsider.client.get(
      `/api/v1/workspaces/${first.id}/students/${student.id}`,
    );

    expect(outsiderDetail.status).toBe(403);

    const outsiderCreate = await post(outsider.client, `/workspaces/${first.id}/students`).send({
      firstName: 'Intruder',
    });

    expect(outsiderCreate.status).toBe(403);
  });

  it('updates profile fields and status, recording the changes', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute');
    const student = await createStudent(owner.client, workspace.id, {
      firstName: 'Nimal',
      lastName: 'Perera',
      grade: 'Grade 8',
    });

    const updated = await patch(
      owner.client,
      `/workspaces/${workspace.id}/students/${student.id}`,
    ).send({ grade: 'Grade 9', city: 'Kandy', status: 'GRADUATED' });

    expect(updated.status).toBe(200);
    expect(updated.body.grade).toBe('Grade 9');
    expect(updated.body.city).toBe('Kandy');
    expect(updated.body.status).toBe('GRADUATED');

    const statusEvents = await context.prisma.auditEvent.findMany({
      where: { type: 'STUDENT_STATUS_CHANGED', targetId: student.id },
    });

    expect(statusEvents).toHaveLength(1);
    expect(statusEvents[0]?.metadata).toEqual({ from: 'ACTIVE', to: 'GRADUATED' });

    const updateEvents = await context.prisma.auditEvent.findMany({
      where: { type: 'STUDENT_UPDATED', targetId: student.id },
    });

    expect(updateEvents).toHaveLength(1);
    expect(updateEvents[0]?.metadata).toEqual({ fields: ['city', 'grade'] });

    const noop = await patch(
      owner.client,
      `/workspaces/${workspace.id}/students/${student.id}`,
    ).send({ grade: 'Grade 9', city: 'Kandy', status: 'GRADUATED' });

    expect(noop.status).toBe(200);

    const auditCount = await context.prisma.auditEvent.count({
      where: {
        targetId: student.id,
        type: { in: ['STUDENT_UPDATED', 'STUDENT_STATUS_CHANGED'] },
      },
    });

    expect(auditCount).toBe(2);

    const emptied = await patch(
      owner.client,
      `/workspaces/${workspace.id}/students/${student.id}`,
    ).send({ lastName: null, city: '' });

    expect(emptied.status).toBe(200);
    expect(emptied.body.lastName).toBeNull();
    expect(emptied.body.city).toBeNull();
  });

  it('rejects unauthenticated access to the student directory', async () => {
    const response = await request(context.app.getHttpServer()).get(
      '/api/v1/workspaces/123e4567-e89b-42d3-a456-426614174000/students',
    );

    expect(response.status).toBe(401);
  });
});
