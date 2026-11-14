import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createTestContext,
  createWorkspace,
  del,
  patch,
  post,
  registerAndLogin,
  registerVerifiedUser,
  truncateAll,
  verifyEmail,
} from './helpers.js';
import type { TestContext } from './helpers.js';

type Client = Awaited<ReturnType<typeof registerAndLogin>>['client'];

describe('Class teachers integration', () => {
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
    role: 'TEACHER' | 'ADMIN' | 'STUDENT' = 'TEACHER',
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

  async function membershipIdFor(ownerClient: Client, workspaceId: string, email: string) {
    const response = await ownerClient.get(`/api/v1/workspaces/${workspaceId}/members`);

    expect(response.status).toBe(200);

    const membership = (response.body as { id: string; user: { email: string } }[]).find(
      (item) => item.user.email === email,
    );

    expect(membership).toBeDefined();

    return membership!.id;
  }

  async function createClass(client: Client, workspaceId: string, name = 'Grade 8 Science') {
    const response = await post(client, `/workspaces/${workspaceId}/classes`).send({ name });

    expect(response.status).toBe(201);

    return response.body as { id: string; name: string; status: string };
  }

  function assignmentsPath(workspaceId: string, classId: string) {
    return `/workspaces/${workspaceId}/classes/${classId}/teachers`;
  }

  it('assigns a primary teacher and shows the assignment on both sides', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    await addMember(owner.client, workspace.id, 'teacher@example.com');
    const teacherId = await membershipIdFor(owner.client, workspace.id, 'teacher@example.com');
    const schoolClass = await createClass(owner.client, workspace.id);

    const assigned = await post(owner.client, assignmentsPath(workspace.id, schoolClass.id)).send({
      membershipId: teacherId,
      isPrimary: true,
    });

    expect(assigned.status).toBe(201);
    expect(assigned.body).toMatchObject({
      classId: schoolClass.id,
      membershipId: teacherId,
      isPrimary: true,
      endedAt: null,
      membership: {
        role: 'TEACHER',
        user: { email: 'teacher@example.com' },
      },
      class: { id: schoolClass.id, status: 'ACTIVE' },
    });

    const roster = await owner.client.get(
      `/api/v1${assignmentsPath(workspace.id, schoolClass.id)}`,
    );

    expect(roster.status).toBe(200);
    expect(roster.body.items).toHaveLength(1);
    expect(roster.body.items[0].isPrimary).toBe(true);
    expect(roster.body.past).toEqual([]);

    const teacherClasses = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/teachers/${teacherId}/classes`,
    );

    expect(teacherClasses.status).toBe(200);
    expect(teacherClasses.body.items).toHaveLength(1);
    expect(teacherClasses.body.items[0].class.id).toBe(schoolClass.id);

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'CLASS_TEACHER_ASSIGNED', workspaceId: workspace.id },
      }),
    ).toBe(1);
  });

  it('moves the primary flag between teachers', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    await addMember(owner.client, workspace.id, 'first@example.com');
    await addMember(owner.client, workspace.id, 'second@example.com');
    const firstId = await membershipIdFor(owner.client, workspace.id, 'first@example.com');
    const secondId = await membershipIdFor(owner.client, workspace.id, 'second@example.com');
    const schoolClass = await createClass(owner.client, workspace.id);

    const first = await post(owner.client, assignmentsPath(workspace.id, schoolClass.id)).send({
      membershipId: firstId,
      isPrimary: true,
    });
    const second = await post(owner.client, assignmentsPath(workspace.id, schoolClass.id)).send({
      membershipId: secondId,
      isPrimary: false,
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const promoted = await patch(
      owner.client,
      `${assignmentsPath(workspace.id, schoolClass.id)}/${second.body.id}`,
    ).send({ isPrimary: true });

    expect(promoted.status).toBe(200);
    expect(promoted.body.isPrimary).toBe(true);

    const roster = await owner.client.get(
      `/api/v1${assignmentsPath(workspace.id, schoolClass.id)}`,
    );

    const primaries = roster.body.items.filter((row: { isPrimary: boolean }) => row.isPrimary);

    expect(primaries).toHaveLength(1);
    expect(primaries[0].membershipId).toBe(secondId);

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'CLASS_TEACHER_PRIMARY_CHANGED', workspaceId: workspace.id },
      }),
    ).toBe(1);
  });

  it('ends an assignment, keeps the history and lets reassignment create a new row', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    await addMember(owner.client, workspace.id, 'teacher@example.com');
    const teacherId = await membershipIdFor(owner.client, workspace.id, 'teacher@example.com');
    const schoolClass = await createClass(owner.client, workspace.id);

    const assigned = await post(owner.client, assignmentsPath(workspace.id, schoolClass.id)).send({
      membershipId: teacherId,
    });

    expect(assigned.status).toBe(201);

    const ended = await del(
      owner.client,
      `${assignmentsPath(workspace.id, schoolClass.id)}/${assigned.body.id}`,
    );

    expect(ended.status).toBe(200);
    expect(ended.body.endedAt).toBeTruthy();

    const roster = await owner.client.get(
      `/api/v1${assignmentsPath(workspace.id, schoolClass.id)}?includeEnded=true`,
    );

    expect(roster.body.items).toEqual([]);
    expect(roster.body.past).toHaveLength(1);
    expect(roster.body.past[0].id).toBe(assigned.body.id);

    const reassigned = await post(owner.client, assignmentsPath(workspace.id, schoolClass.id)).send(
      {
        membershipId: teacherId,
      },
    );

    expect(reassigned.status).toBe(201);
    expect(reassigned.body.id).not.toBe(assigned.body.id);

    const history = await context.prisma.classTeacher.findMany({
      where: { classId: schoolClass.id, membershipId: teacherId },
      orderBy: { createdAt: 'asc' },
    });

    expect(history).toHaveLength(2);
    expect(history[0]?.endedAt).not.toBeNull();
    expect(history[1]?.endedAt).toBeNull();

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'CLASS_TEACHER_REMOVED', workspaceId: workspace.id },
      }),
    ).toBe(1);
  });

  it('shows past classes to managers only', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const teacher = await addMember(owner.client, workspace.id, 'teacher@example.com');
    const colleague = await addMember(owner.client, workspace.id, 'colleague@example.com');
    const teacherId = await membershipIdFor(owner.client, workspace.id, 'teacher@example.com');
    const schoolClass = await createClass(owner.client, workspace.id);

    const assigned = await post(owner.client, assignmentsPath(workspace.id, schoolClass.id)).send({
      membershipId: teacherId,
    });

    await del(owner.client, `${assignmentsPath(workspace.id, schoolClass.id)}/${assigned.body.id}`);

    const managerView = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/teachers/${teacherId}/classes`,
    );

    expect(managerView.status).toBe(200);
    expect(managerView.body.past).toHaveLength(1);

    const managerClassView = await owner.client.get(
      `/api/v1${assignmentsPath(workspace.id, schoolClass.id)}?includeEnded=true`,
    );

    expect(managerClassView.body.past).toHaveLength(1);

    const teacherClassView = await teacher.client.get(
      `/api/v1${assignmentsPath(workspace.id, schoolClass.id)}?includeEnded=true`,
    );

    expect(teacherClassView.status).toBe(200);
    expect(teacherClassView.body.past).toEqual([]);

    const teacherView = await teacher.client.get(
      `/api/v1/workspaces/${workspace.id}/teachers/${teacherId}/classes`,
    );

    expect(teacherView.status).toBe(200);
    expect(teacherView.body.items).toEqual([]);
    expect(teacherView.body.past).toEqual([]);

    const colleagueView = await colleague.client.get(
      `/api/v1/workspaces/${workspace.id}/teachers/${teacherId}/classes`,
    );

    expect(colleagueView.status).toBe(200);
    expect(colleagueView.body.past).toEqual([]);
  });

  it('blocks duplicates, archived classes and ineligible members', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    await addMember(owner.client, workspace.id, 'teacher@example.com');
    await addMember(owner.client, workspace.id, 'student@example.com', 'STUDENT');
    const teacherId = await membershipIdFor(owner.client, workspace.id, 'teacher@example.com');
    const studentId = await membershipIdFor(owner.client, workspace.id, 'student@example.com');
    const schoolClass = await createClass(owner.client, workspace.id);

    const first = await post(owner.client, assignmentsPath(workspace.id, schoolClass.id)).send({
      membershipId: teacherId,
    });

    expect(first.status).toBe(201);

    const duplicate = await post(owner.client, assignmentsPath(workspace.id, schoolClass.id)).send({
      membershipId: teacherId,
    });

    expect(duplicate.status).toBe(409);

    const ineligible = await post(owner.client, assignmentsPath(workspace.id, schoolClass.id)).send(
      {
        membershipId: studentId,
      },
    );

    expect(ineligible.status).toBe(404);

    const missing = await post(owner.client, assignmentsPath(workspace.id, schoolClass.id)).send({
      membershipId: '33333333-3333-4333-8333-333333333333',
    });

    expect(missing.status).toBe(404);

    await patch(owner.client, `/workspaces/${workspace.id}/classes/${schoolClass.id}`)
      .send({ status: 'ARCHIVED' })
      .expect(200);

    const archived = await post(owner.client, assignmentsPath(workspace.id, schoolClass.id)).send({
      membershipId: teacherId,
    });

    expect(archived.status).toBe(409);

    expect(await context.prisma.classTeacher.count()).toBe(1);
  });

  it('gives teachers read access while students and outsiders are refused', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const teacher = await addMember(owner.client, workspace.id, 'teacher@example.com');
    const student = await addMember(owner.client, workspace.id, 'student@example.com', 'STUDENT');
    const outsider = await registerVerifiedUser(context, 'outsider@example.com');
    const teacherId = await membershipIdFor(owner.client, workspace.id, 'teacher@example.com');
    const schoolClass = await createClass(owner.client, workspace.id);

    await post(owner.client, assignmentsPath(workspace.id, schoolClass.id)).send({
      membershipId: teacherId,
    });

    const readable = await teacher.client.get(
      `/api/v1${assignmentsPath(workspace.id, schoolClass.id)}`,
    );

    expect(readable.status).toBe(200);
    expect(readable.body.items).toHaveLength(1);

    const teacherAssign = await post(
      teacher.client,
      assignmentsPath(workspace.id, schoolClass.id),
    ).send({ membershipId: teacherId });

    expect(teacherAssign.status).toBe(403);

    const studentRead = await student.client.get(
      `/api/v1${assignmentsPath(workspace.id, schoolClass.id)}`,
    );
    const outsiderRead = await outsider.client.get(
      `/api/v1${assignmentsPath(workspace.id, schoolClass.id)}`,
    );

    expect(studentRead.status).toBe(403);
    expect(outsiderRead.status).toBe(403);
  });

  it('refuses assignments that cross workspace boundaries', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const outsider = await registerVerifiedUser(context, 'outsider@example.com');
    const workspace = await createWorkspace(owner.client, 'First', 'INSTITUTE');
    const otherWorkspace = await createWorkspace(outsider.client, 'Second', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const otherClass = await createClass(outsider.client, otherWorkspace.id, 'Other Class');

    await addMember(outsider.client, otherWorkspace.id, 'other-teacher@example.com');
    const otherTeacherId = await membershipIdFor(
      outsider.client,
      otherWorkspace.id,
      'other-teacher@example.com',
    );

    const crossAssign = await post(
      owner.client,
      assignmentsPath(workspace.id, schoolClass.id),
    ).send({ membershipId: otherTeacherId });

    expect(crossAssign.status).toBe(404);

    const crossList = await owner.client.get(
      `/api/v1${assignmentsPath(otherWorkspace.id, otherClass.id)}`,
    );

    expect(crossList.status).toBe(403);
  });

  it('refuses to delete a class with teacher assignments', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    await addMember(owner.client, workspace.id, 'teacher@example.com');
    const teacherId = await membershipIdFor(owner.client, workspace.id, 'teacher@example.com');
    const schoolClass = await createClass(owner.client, workspace.id);

    await post(owner.client, assignmentsPath(workspace.id, schoolClass.id)).send({
      membershipId: teacherId,
    });

    const blocked = await del(
      owner.client,
      `/workspaces/${workspace.id}/classes/${schoolClass.id}`,
    );

    expect(blocked.status).toBe(409);
    expect(await context.prisma.class.count()).toBe(1);
  });

  it('rejects invalid assignment payloads', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);

    for (const body of [
      {},
      { membershipId: 'not-a-uuid' },
      { membershipId: '11111111-1111-4111-8111-111111111111', unknown: true },
      { membershipId: '11111111-1111-4111-8111-111111111111', isPrimary: 'maybe' },
    ]) {
      await post(owner.client, assignmentsPath(workspace.id, schoolClass.id))
        .send(body)
        .expect(400);
    }

    expect(await context.prisma.classTeacher.count()).toBe(0);
  });
});
