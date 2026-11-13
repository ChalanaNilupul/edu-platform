import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createTestContext,
  createWorkspace,
  del,
  patch,
  post,
  registerAndLogin,
  truncateAll,
  verifyEmail,
} from './helpers.js';
import type { TestContext } from './helpers.js';

type Client = Awaited<ReturnType<typeof registerAndLogin>>['client'];

describe('Classes and enrollments integration', () => {
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

  async function addMember(
    ownerClient: Client,
    workspaceId: string,
    email: string,
    role: 'TEACHER' | 'ADMIN',
  ) {
    const member = await registerAndLogin(context, email);

    await verifyEmail(context, member.client, email);

    const invitation = await post(ownerClient, `/workspaces/${workspaceId}/invitations`).send({
      email,
      role,
    });

    expect(invitation.status).toBe(201);

    const accepted = await post(member.client, '/invitations/accept').send({
      token: context.mail.invitations.at(-1)!.token,
    });

    expect(accepted.status).toBe(200);

    return member;
  }

  async function createStudent(client: Client, workspaceId: string, firstName: string) {
    const response = await post(client, `/workspaces/${workspaceId}/students`).send({ firstName });

    expect(response.status).toBe(201);

    return response.body as { id: string; firstName: string };
  }

  async function createClass(
    client: Client,
    workspaceId: string,
    body: Record<string, unknown> = {},
  ) {
    const response = await post(client, `/workspaces/${workspaceId}/classes`).send({
      name: 'Grade 8 Science',
      ...body,
    });

    expect(response.status).toBe(201);

    return response.body as { id: string; name: string; enrolledCount: number; status: string };
  }

  it('creates classes, enrolls students and reports roster and history', async () => {
    const owner = await registerAndLogin(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');

    const schoolClass = await createClass(owner.client, workspace.id, {
      grade: 'Grade 8',
      capacity: 30,
    });

    expect(schoolClass).toMatchObject({
      name: 'Grade 8 Science',
      grade: 'Grade 8',
      capacity: 30,
      status: 'ACTIVE',
      enrolledCount: 0,
    });

    const nimal = await createStudent(owner.client, workspace.id, 'Nimal');
    const kamal = await createStudent(owner.client, workspace.id, 'Kamal');

    for (const student of [nimal, kamal]) {
      const enrolled = await post(
        owner.client,
        `/workspaces/${workspace.id}/classes/${schoolClass.id}/enrollments`,
      ).send({ studentId: student.id, enrolledAt: '2026-01-05' });

      expect(enrolled.status).toBe(201);
      expect(enrolled.body).toMatchObject({
        status: 'ACTIVE',
        enrolledAt: '2026-01-05T00:00:00.000Z',
        endedAt: null,
        student: { id: student.id },
        class: { id: schoolClass.id },
      });
    }

    const directory = await owner.client.get(`/api/v1/workspaces/${workspace.id}/classes`);

    expect(directory.status).toBe(200);
    expect(directory.body.total).toBe(1);
    expect(directory.body.items[0]).toMatchObject({
      id: schoolClass.id,
      enrolledCount: 2,
    });

    const detail = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/classes/${schoolClass.id}`,
    );

    expect(detail.body.enrolledCount).toBe(2);

    const roster = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/classes/${schoolClass.id}/enrollments?status=ACTIVE`,
    );

    expect(roster.status).toBe(200);
    expect(roster.body.total).toBe(2);
    expect(
      roster.body.items.map((row: { student: { firstName: string } }) => row.student.firstName),
    ).toEqual(['Kamal', 'Nimal']);

    const history = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/students/${nimal.id}/enrollments`,
    );

    expect(history.status).toBe(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0]).toMatchObject({
      status: 'ACTIVE',
      class: { id: schoolClass.id, name: 'Grade 8 Science' },
    });

    const created = await context.prisma.auditEvent.count({
      where: { type: 'CLASS_CREATED', workspaceId: workspace.id },
    });
    const enrolled = await context.prisma.auditEvent.count({
      where: { type: 'STUDENT_ENROLLED', workspaceId: workspace.id },
    });

    expect(created).toBe(1);
    expect(enrolled).toBe(2);
  });

  it('blocks duplicate active enrollment, keeps history and allows re-enrollment', async () => {
    const owner = await registerAndLogin(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const student = await createStudent(owner.client, workspace.id, 'Nimal');

    const path = `/workspaces/${workspace.id}/classes/${schoolClass.id}/enrollments`;

    const first = await post(owner.client, path).send({
      studentId: student.id,
      enrolledAt: '2026-01-05',
    });

    expect(first.status).toBe(201);

    const duplicate = await post(owner.client, path).send({ studentId: student.id });

    expect(duplicate.status).toBe(409);

    const completed = await patch(
      owner.client,
      `/workspaces/${workspace.id}/enrollments/${first.body.id}`,
    ).send({ status: 'COMPLETED' });

    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.endedAt).toBeTruthy();

    const again = await post(owner.client, path).send({
      studentId: student.id,
      enrolledAt: '2026-06-01',
    });

    expect(again.status).toBe(201);

    const history = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/students/${student.id}/enrollments`,
    );

    expect(history.body).toHaveLength(2);
    expect(history.body[0]).toMatchObject({ status: 'ACTIVE' });
    expect(history.body[1]).toMatchObject({ status: 'COMPLETED' });

    const auditEvents = await context.prisma.auditEvent.findMany({
      where: { type: 'ENROLLMENT_UPDATED', workspaceId: workspace.id },
    });

    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]?.metadata).toMatchObject({
      from: 'ACTIVE',
      to: 'COMPLETED',
      studentId: student.id,
      classId: schoolClass.id,
    });
  });

  it('enforces capacity and refuses enrollment into an archived class', async () => {
    const owner = await registerAndLogin(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id, { capacity: 1 });
    const nimal = await createStudent(owner.client, workspace.id, 'Nimal');
    const kamal = await createStudent(owner.client, workspace.id, 'Kamal');

    const path = `/workspaces/${workspace.id}/classes/${schoolClass.id}/enrollments`;

    expect((await post(owner.client, path).send({ studentId: nimal.id })).status).toBe(201);
    expect((await post(owner.client, path).send({ studentId: kamal.id })).status).toBe(409);

    const archived = await patch(
      owner.client,
      `/workspaces/${workspace.id}/classes/${schoolClass.id}`,
    ).send({ status: 'ARCHIVED' });

    expect(archived.status).toBe(200);
    expect(archived.body.status).toBe('ARCHIVED');

    expect((await post(owner.client, path).send({ studentId: kamal.id })).status).toBe(409);

    const enrollment = await context.prisma.enrollment.findFirstOrThrow({
      where: { studentId: nimal.id },
    });

    await context.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: 'COMPLETED', endedAt: new Date('2026-02-01') },
    });

    const reactivate = await patch(
      owner.client,
      `/workspaces/${workspace.id}/enrollments/${enrollment.id}`,
    ).send({ status: 'ACTIVE' });

    expect(reactivate.status).toBe(409);
  });

  it('refuses to delete a class with enrollment records', async () => {
    const owner = await registerAndLogin(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const student = await createStudent(owner.client, workspace.id, 'Nimal');

    await post(
      owner.client,
      `/workspaces/${workspace.id}/classes/${schoolClass.id}/enrollments`,
    ).send({ studentId: student.id });

    const blocked = await del(
      owner.client,
      `/workspaces/${workspace.id}/classes/${schoolClass.id}`,
    );

    expect(blocked.status).toBe(409);

    const empty = await createClass(owner.client, workspace.id, { name: 'Empty Class' });

    expect(
      (await del(owner.client, `/workspaces/${workspace.id}/classes/${empty.id}`)).status,
    ).toBe(200);

    const listed = await owner.client.get(`/api/v1/workspaces/${workspace.id}/classes`);

    expect(listed.body.total).toBe(1);
    expect(listed.body.items[0]?.id).toBe(schoolClass.id);

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'CLASS_DELETED', workspaceId: workspace.id },
      }),
    ).toBe(1);
  });

  it('lets teachers read classes and rosters but not change them', async () => {
    const owner = await registerAndLogin(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const student = await createStudent(owner.client, workspace.id, 'Nimal');
    const teacher = await addMember(owner.client, workspace.id, 'teacher@example.com', 'TEACHER');

    const list = await teacher.client.get(`/api/v1/workspaces/${workspace.id}/classes`);
    const roster = await teacher.client.get(
      `/api/v1/workspaces/${workspace.id}/classes/${schoolClass.id}/enrollments`,
    );
    const history = await teacher.client.get(
      `/api/v1/workspaces/${workspace.id}/students/${student.id}/enrollments`,
    );

    expect(list.status).toBe(200);
    expect(roster.status).toBe(200);
    expect(history.status).toBe(200);

    expect(
      (
        await post(teacher.client, `/workspaces/${workspace.id}/classes`).send({
          name: 'Teacher Class',
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await patch(teacher.client, `/workspaces/${workspace.id}/classes/${schoolClass.id}`).send({
          grade: 'Grade 9',
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await post(
          teacher.client,
          `/workspaces/${workspace.id}/classes/${schoolClass.id}/enrollments`,
        ).send({ studentId: student.id })
      ).status,
    ).toBe(403);
  });

  it('isolates classes and students between workspaces', async () => {
    const owner = await registerAndLogin(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const student = await createStudent(owner.client, workspace.id, 'Nimal');

    const outsider = await registerAndLogin(context, 'outsider@example.com');
    const otherWorkspace = await createWorkspace(outsider.client, 'Other Institute', 'INSTITUTE');
    const otherClass = await createClass(outsider.client, otherWorkspace.id, {
      name: 'Other Class',
    });
    const otherStudent = await createStudent(outsider.client, otherWorkspace.id, 'Outsider Kid');

    await outsider.client.get(`/api/v1/workspaces/${workspace.id}/classes`).expect(403);

    await post(outsider.client, `/workspaces/${workspace.id}/classes`)
      .send({ name: 'Sneaky' })
      .expect(403);

    await post(
      outsider.client,
      `/workspaces/${otherWorkspace.id}/classes/${otherClass.id}/enrollments`,
    )
      .send({ studentId: student.id })
      .expect(404);

    const otherRoster = await outsider.client.get(
      `/api/v1/workspaces/${otherWorkspace.id}/classes/${otherClass.id}/enrollments`,
    );

    expect(otherRoster.body.total).toBe(0);

    const otherDirectory = await outsider.client.get(
      `/api/v1/workspaces/${otherWorkspace.id}/classes`,
    );

    expect(otherDirectory.body.items.map((row: { id: string }) => row.id)).toEqual([otherClass.id]);
    expect(otherStudent.id).not.toBe(student.id);
  });

  it('rejects invalid class and enrollment data', async () => {
    const owner = await registerAndLogin(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const student = await createStudent(owner.client, workspace.id, 'Nimal');

    for (const body of [
      {},
      { name: '   ' },
      { name: 'Grade 8', capacity: 0 },
      { name: 'Grade 8', unknown: true },
    ]) {
      await post(owner.client, `/workspaces/${workspace.id}/classes`).send(body).expect(400);
    }

    for (const body of [
      {},
      { studentId: student.id, enrolledAt: 'not-a-date' },
      { studentId: 'missing' },
    ]) {
      await post(owner.client, `/workspaces/${workspace.id}/classes/${schoolClass.id}/enrollments`)
        .send(body)
        .expect(400);
    }

    const valid = await post(
      owner.client,
      `/workspaces/${workspace.id}/classes/${schoolClass.id}/enrollments`,
    ).send({ studentId: student.id });

    expect(valid.status).toBe(201);

    await patch(owner.client, `/workspaces/${workspace.id}/enrollments/${valid.body.id}`)
      .send({ status: 'DROPPED' })
      .expect(400);

    await patch(owner.client, `/workspaces/${workspace.id}/enrollments/${valid.body.id}`)
      .send({ endedAt: 'yesterday' })
      .expect(400);

    await patch(owner.client, `/workspaces/${workspace.id}/enrollments/${valid.body.id}`)
      .send({})
      .expect(400);

    expect(await context.prisma.enrollment.count()).toBe(1);
  });

  it('rejects unauthenticated access to classes', async () => {
    await request(context.app.getHttpServer())
      .get('/api/v1/workspaces/123e4567-e89b-42d3-a456-426614174000/classes')
      .expect(401);

    await request(context.app.getHttpServer())
      .post('/api/v1/workspaces/123e4567-e89b-42d3-a456-426614174000/classes')
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Anonymous Class' })
      .expect(401);
  });
});
