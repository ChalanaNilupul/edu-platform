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
import type { createAgent, TestContext } from './helpers.js';

type GuardianResponse = {
  id: string;
  firstName: string;
  lastName: string | null;
  relationship: string;
  email: string | null;
  occupation: string | null;
};

type GuardianLinkResponse = {
  id: string;
  isPrimary: boolean;
  guardian: GuardianResponse;
};

type StudentResponse = { id: string; firstName: string };

describe('Guardian management integration', () => {
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
  ): Promise<StudentResponse> {
    const response = await post(client, `/workspaces/${workspaceId}/students`).send({
      firstName: 'Nimal',
      lastName: 'Perera',
      grade: 'Grade 8',
    });

    expect(response.status).toBe(201);

    return response.body as StudentResponse;
  }

  async function createGuardian(
    client: ReturnType<typeof createAgent>,
    workspaceId: string,
    studentId: string,
    body: Record<string, unknown>,
  ): Promise<GuardianLinkResponse> {
    const response = await post(
      client,
      `/workspaces/${workspaceId}/students/${studentId}/guardians`,
    ).send(body);

    expect(response.status).toBe(201);

    return response.body as GuardianLinkResponse;
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

  it('creates guardians, keeps one primary contact and lists them for the student', async () => {
    const owner = await registerAndLogin(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const student = await createStudent(owner.client, workspace.id);

    const father = await createGuardian(owner.client, workspace.id, student.id, {
      firstName: 'Sunil',
      lastName: 'Perera',
      relationship: 'FATHER',
      email: 'SUNIL@EXAMPLE.COM',
      phone: '+94770000002',
    });

    expect(father.isPrimary).toBe(true);
    expect(father.guardian.email).toBe('sunil@example.com');

    const mother = await createGuardian(owner.client, workspace.id, student.id, {
      firstName: 'Chamari',
      relationship: 'MOTHER',
      isPrimary: true,
    });

    expect(mother.isPrimary).toBe(true);

    const list = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/students/${student.id}/guardians`,
    );

    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(2);
    expect(list.body.items[0].guardian.firstName).toBe('Chamari');
    expect(list.body.items[0].isPrimary).toBe(true);
    expect(list.body.items[1].guardian.firstName).toBe('Sunil');
    expect(list.body.items[1].isPrimary).toBe(false);

    const detail = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/guardians/${father.guardian.id}`,
    );

    expect(detail.status).toBe(200);
    expect(detail.body.linkedStudents).toEqual([
      { id: student.id, studentCode: null, firstName: 'Nimal', lastName: 'Perera' },
    ]);

    const created = await context.prisma.auditEvent.count({
      where: { type: 'GUARDIAN_CREATED', workspaceId: workspace.id },
    });

    expect(created).toBe(2);
  });

  it('updates guardian details and records only the changed fields', async () => {
    const owner = await registerAndLogin(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute');
    const student = await createStudent(owner.client, workspace.id);
    const link = await createGuardian(owner.client, workspace.id, student.id, {
      firstName: 'Sunil',
      relationship: 'FATHER',
      email: 'sunil@example.com',
      phone: '+94770000002',
    });

    const updated = await patch(
      owner.client,
      `/workspaces/${workspace.id}/guardians/${link.guardian.id}`,
    ).send({ occupation: 'Carpenter', phone: '+94770000002' });

    expect(updated.status).toBe(200);
    expect(updated.body.occupation).toBe('Carpenter');

    const events = await context.prisma.auditEvent.findMany({
      where: { type: 'GUARDIAN_UPDATED', targetId: link.guardian.id },
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.metadata).toEqual({ fields: ['occupation'] });

    const noop = await patch(
      owner.client,
      `/workspaces/${workspace.id}/guardians/${link.guardian.id}`,
    ).send({ occupation: 'Carpenter' });

    expect(noop.status).toBe(200);

    const auditCount = await context.prisma.auditEvent.count({
      where: { type: 'GUARDIAN_UPDATED', targetId: link.guardian.id },
    });

    expect(auditCount).toBe(1);

    const emptied = await patch(
      owner.client,
      `/workspaces/${workspace.id}/guardians/${link.guardian.id}`,
    ).send({ email: null, relationship: 'GUARDIAN' });

    expect(emptied.status).toBe(200);
    expect(emptied.body.email).toBeNull();
    expect(emptied.body.relationship).toBe('GUARDIAN');
  });

  it('unlinks a guardian before allowing the record to be deleted', async () => {
    const owner = await registerAndLogin(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute');
    const student = await createStudent(owner.client, workspace.id);
    const link = await createGuardian(owner.client, workspace.id, student.id, {
      firstName: 'Sunil',
      relationship: 'FATHER',
    });

    const blocked = await del(
      owner.client,
      `/workspaces/${workspace.id}/guardians/${link.guardian.id}`,
    );

    expect(blocked.status).toBe(409);

    const unlinked = await del(
      owner.client,
      `/workspaces/${workspace.id}/students/${student.id}/guardians/${link.guardian.id}`,
    );

    expect(unlinked.status).toBe(200);

    const list = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/students/${student.id}/guardians`,
    );

    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(0);

    const removed = await del(
      owner.client,
      `/workspaces/${workspace.id}/guardians/${link.guardian.id}`,
    );

    expect(removed.status).toBe(200);

    const detail = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/guardians/${link.guardian.id}`,
    );

    expect(detail.status).toBe(404);

    const unlinkEvents = await context.prisma.auditEvent.count({
      where: { type: 'GUARDIAN_UNLINKED', targetId: link.guardian.id },
    });
    const deleteEvents = await context.prisma.auditEvent.count({
      where: { type: 'GUARDIAN_DELETED', targetId: link.guardian.id },
    });

    expect(unlinkEvents).toBe(1);
    expect(deleteEvents).toBe(1);
  });

  it('lets teachers read guardians but not change them', async () => {
    const owner = await registerAndLogin(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const teacher = await addTeacher(owner.client, workspace.id, 'teacher@example.com');
    const student = await createStudent(owner.client, workspace.id);
    const link = await createGuardian(owner.client, workspace.id, student.id, {
      firstName: 'Sunil',
      relationship: 'FATHER',
    });

    const list = await teacher.client.get(
      `/api/v1/workspaces/${workspace.id}/students/${student.id}/guardians`,
    );

    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);

    const detail = await teacher.client.get(
      `/api/v1/workspaces/${workspace.id}/guardians/${link.guardian.id}`,
    );

    expect(detail.status).toBe(200);

    const created = await post(
      teacher.client,
      `/workspaces/${workspace.id}/students/${student.id}/guardians`,
    ).send({ firstName: 'Chamari', relationship: 'MOTHER' });

    expect(created.status).toBe(403);

    const updated = await patch(
      teacher.client,
      `/workspaces/${workspace.id}/guardians/${link.guardian.id}`,
    ).send({ occupation: 'Carpenter' });

    expect(updated.status).toBe(403);

    const unlinked = await del(
      teacher.client,
      `/workspaces/${workspace.id}/students/${student.id}/guardians/${link.guardian.id}`,
    );

    expect(unlinked.status).toBe(403);

    const removed = await del(
      teacher.client,
      `/workspaces/${workspace.id}/guardians/${link.guardian.id}`,
    );

    expect(removed.status).toBe(403);
  });

  it('isolates guardian records between workspaces and from outsiders', async () => {
    const owner = await registerAndLogin(context, 'owner@example.com');
    const first = await createWorkspace(owner.client, 'First');
    const second = await createWorkspace(owner.client, 'Second');
    const outsider = await registerAndLogin(context, 'outsider@example.com');

    const student = await createStudent(owner.client, first.id);
    const link = await createGuardian(owner.client, first.id, student.id, {
      firstName: 'Sunil',
      relationship: 'FATHER',
    });

    const crossWorkspaceGuardian = await owner.client.get(
      `/api/v1/workspaces/${second.id}/guardians/${link.guardian.id}`,
    );

    expect(crossWorkspaceGuardian.status).toBe(404);

    const crossWorkspaceList = await owner.client.get(
      `/api/v1/workspaces/${second.id}/students/${student.id}/guardians`,
    );

    expect(crossWorkspaceList.status).toBe(404);

    const crossWorkspaceUnlink = await del(
      owner.client,
      `/workspaces/${second.id}/students/${student.id}/guardians/${link.guardian.id}`,
    );

    expect(crossWorkspaceUnlink.status).toBe(404);

    const outsiderList = await outsider.client.get(
      `/api/v1/workspaces/${first.id}/students/${student.id}/guardians`,
    );

    expect(outsiderList.status).toBe(403);

    const outsiderDetail = await outsider.client.get(
      `/api/v1/workspaces/${first.id}/guardians/${link.guardian.id}`,
    );

    expect(outsiderDetail.status).toBe(403);

    const outsiderCreate = await post(
      outsider.client,
      `/workspaces/${first.id}/students/${student.id}/guardians`,
    ).send({ firstName: 'Intruder', relationship: 'OTHER' });

    expect(outsiderCreate.status).toBe(403);
  });

  it('rejects invalid guardian data and unknown relationships', async () => {
    const owner = await registerAndLogin(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute');
    const student = await createStudent(owner.client, workspace.id);

    const missingRelationship = await post(
      owner.client,
      `/workspaces/${workspace.id}/students/${student.id}/guardians`,
    ).send({ firstName: 'Sunil' });

    expect(missingRelationship.status).toBe(400);

    const unknownRelationship = await post(
      owner.client,
      `/workspaces/${workspace.id}/students/${student.id}/guardians`,
    ).send({ firstName: 'Sunil', relationship: 'UNCLE' });

    expect(unknownRelationship.status).toBe(400);

    const badEmail = await post(
      owner.client,
      `/workspaces/${workspace.id}/students/${student.id}/guardians`,
    ).send({ firstName: 'Sunil', relationship: 'FATHER', email: 'not-an-email' });

    expect(badEmail.status).toBe(400);

    const emptyUpdate = await patch(
      owner.client,
      `/workspaces/${workspace.id}/guardians/123e4567-e89b-42d3-a456-426614174000`,
    ).send({});

    expect(emptyUpdate.status).toBe(400);
  });

  it('rejects unauthenticated access to guardian records', async () => {
    const response = await request(context.app.getHttpServer()).get(
      '/api/v1/workspaces/123e4567-e89b-42d3-a456-426614174000/students/223e4567-e89b-42d3-a456-426614174000/guardians',
    );

    expect(response.status).toBe(401);
  });
});
