import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createTestContext,
  createWorkspace,
  del,
  patch,
  post,
  put,
  registerAndLogin,
  registerVerifiedUser,
  truncateAll,
  verifyEmail,
} from './helpers.js';
import type { TestContext } from './helpers.js';

type Client = Awaited<ReturnType<typeof registerAndLogin>>['client'];

describe('Subjects integration', () => {
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

  async function createSubject(
    client: Client,
    workspaceId: string,
    body: { name: string; code?: string; description?: string },
  ) {
    const response = await post(client, `/workspaces/${workspaceId}/subjects`).send(body);

    expect(response.status).toBe(201);

    return response.body as {
      id: string;
      name: string;
      code: string | null;
      description: string | null;
      status: string;
      classCount: number;
    };
  }

  async function createClass(client: Client, workspaceId: string, name = 'Grade 8 Science') {
    const response = await post(client, `/workspaces/${workspaceId}/classes`).send({ name });

    expect(response.status).toBe(201);

    return response.body as { id: string; name: string; status: string };
  }

  it('creates a subject, audits it and lists it with a class count', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');

    const created = await createSubject(owner.client, workspace.id, {
      name: 'Mathematics',
      code: 'math',
      description: 'Core subject',
    });

    expect(created).toMatchObject({
      name: 'Mathematics',
      code: 'MATH',
      description: 'Core subject',
      status: 'ACTIVE',
      classCount: 0,
    });

    const list = await owner.client.get(`/api/v1/workspaces/${workspace.id}/subjects`);

    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toMatchObject({ id: created.id, classCount: 0 });

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'SUBJECT_CREATED', workspaceId: workspace.id },
      }),
    ).toBe(1);
  });

  it('searches, filters and paginates the subject directory', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');

    await createSubject(owner.client, workspace.id, { name: 'Mathematics', code: 'MATH' });
    await createSubject(owner.client, workspace.id, { name: 'Science', code: 'SCI' });
    const english = await createSubject(owner.client, workspace.id, {
      name: 'English',
      code: 'ENG',
    });

    const bySearch = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/subjects?search=sci`,
    );

    expect(bySearch.body.items.map((row: { name: string }) => row.name)).toEqual(['Science']);

    const byCode = await owner.client.get(`/api/v1/workspaces/${workspace.id}/subjects?search=eng`);

    expect(byCode.body.items.map((row: { id: string }) => row.id)).toEqual([english.id]);

    await patch(owner.client, `/workspaces/${workspace.id}/subjects/${english.id}`)
      .send({ status: 'ARCHIVED' })
      .expect(200);

    const archivedOnly = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/subjects?status=ARCHIVED`,
    );

    expect(archivedOnly.body.items.map((row: { id: string }) => row.id)).toEqual([english.id]);

    const paged = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/subjects?page=2&pageSize=2`,
    );

    expect(paged.body).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
    expect(paged.body.items).toHaveLength(1);
  });

  it('rejects duplicate names, duplicate codes and invalid payloads', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');

    await createSubject(owner.client, workspace.id, { name: 'Mathematics', code: 'MATH' });

    const duplicateName = await post(owner.client, `/workspaces/${workspace.id}/subjects`).send({
      name: 'Mathematics',
    });

    expect(duplicateName.status).toBe(409);

    const duplicateCode = await post(owner.client, `/workspaces/${workspace.id}/subjects`).send({
      name: 'Advanced Mathematics',
      code: 'MATH',
    });

    expect(duplicateCode.status).toBe(409);

    for (const body of [
      {},
      { name: '   ' },
      { name: 'Science', code: 'X'.repeat(21) },
      { name: 'Science', status: 'ACTIVE' },
      { name: 'Science', unknown: true },
    ]) {
      await post(owner.client, `/workspaces/${workspace.id}/subjects`).send(body).expect(400);
    }

    expect(await context.prisma.subject.count()).toBe(1);
  });

  it('updates a subject and records archiving under its own event', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const subject = await createSubject(owner.client, workspace.id, { name: 'Mathematics' });

    const updated = await patch(
      owner.client,
      `/workspaces/${workspace.id}/subjects/${subject.id}`,
    ).send({ name: 'Advanced Mathematics', description: 'For grade 12' });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      name: 'Advanced Mathematics',
      description: 'For grade 12',
    });

    const noChange = await patch(
      owner.client,
      `/workspaces/${workspace.id}/subjects/${subject.id}`,
    ).send({ name: 'Advanced Mathematics' });

    expect(noChange.status).toBe(200);

    const archived = await patch(
      owner.client,
      `/workspaces/${workspace.id}/subjects/${subject.id}`,
    ).send({ status: 'ARCHIVED' });

    expect(archived.status).toBe(200);
    expect(archived.body.status).toBe('ARCHIVED');

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'SUBJECT_UPDATED', workspaceId: workspace.id },
      }),
    ).toBe(1);

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'SUBJECT_ARCHIVED', workspaceId: workspace.id },
      }),
    ).toBe(1);
  });

  it('deletes an unused subject but refuses one linked to a class', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const unused = await createSubject(owner.client, workspace.id, { name: 'Music' });
    const linked = await createSubject(owner.client, workspace.id, { name: 'Mathematics' });
    const schoolClass = await createClass(owner.client, workspace.id);

    await put(owner.client, `/workspaces/${workspace.id}/classes/${schoolClass.id}/subjects`)
      .send({ subjectIds: [linked.id] })
      .expect(200);

    const blocked = await del(owner.client, `/workspaces/${workspace.id}/subjects/${linked.id}`);

    expect(blocked.status).toBe(409);

    const removed = await del(owner.client, `/workspaces/${workspace.id}/subjects/${unused.id}`);

    expect(removed.status).toBe(200);
    expect(await context.prisma.subject.count()).toBe(1);

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'SUBJECT_DELETED', workspaceId: workspace.id },
      }),
    ).toBe(1);
  });

  it('links subjects to a class and replaces the selection', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const maths = await createSubject(owner.client, workspace.id, { name: 'Mathematics' });
    const science = await createSubject(owner.client, workspace.id, { name: 'Science' });
    const schoolClass = await createClass(owner.client, workspace.id);

    const linked = await put(
      owner.client,
      `/workspaces/${workspace.id}/classes/${schoolClass.id}/subjects`,
    ).send({ subjectIds: [maths.id, science.id] });

    expect(linked.status).toBe(200);
    expect(linked.body.items).toHaveLength(2);

    const classList = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/classes/${schoolClass.id}/subjects`,
    );

    expect(classList.status).toBe(200);
    expect(classList.body.items.map((row: { id: string }) => row.id).sort()).toEqual(
      [maths.id, science.id].sort(),
    );

    const directory = await owner.client.get(`/api/v1/workspaces/${workspace.id}/subjects`);

    expect(directory.body.items.find((row: { id: string }) => row.id === maths.id).classCount).toBe(
      1,
    );

    const reduced = await put(
      owner.client,
      `/workspaces/${workspace.id}/classes/${schoolClass.id}/subjects`,
    ).send({ subjectIds: [maths.id] });

    expect(reduced.status).toBe(200);
    expect(reduced.body.items.map((row: { id: string }) => row.id)).toEqual([maths.id]);

    await put(owner.client, `/workspaces/${workspace.id}/classes/${schoolClass.id}/subjects`)
      .send({ subjectIds: [maths.id] })
      .expect(200);

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'CLASS_SUBJECTS_CHANGED', workspaceId: workspace.id },
      }),
    ).toBe(2);
  });

  it('blocks archived subjects, archived classes and unknown subject ids', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const retired = await createSubject(owner.client, workspace.id, { name: 'Retired' });
    const schoolClass = await createClass(owner.client, workspace.id);
    const path = `/workspaces/${workspace.id}/classes/${schoolClass.id}/subjects`;

    await patch(owner.client, `/workspaces/${workspace.id}/subjects/${retired.id}`)
      .send({ status: 'ARCHIVED' })
      .expect(200);

    const archivedSubject = await put(owner.client, path).send({ subjectIds: [retired.id] });

    expect(archivedSubject.status).toBe(409);

    const missingSubject = await put(owner.client, path).send({
      subjectIds: ['11111111-1111-4111-8111-111111111111'],
    });

    expect(missingSubject.status).toBe(404);

    await patch(owner.client, `/workspaces/${workspace.id}/classes/${schoolClass.id}`)
      .send({ status: 'ARCHIVED' })
      .expect(200);

    const archivedClass = await put(owner.client, path).send({ subjectIds: [] });

    expect(archivedClass.status).toBe(409);
    expect(await context.prisma.classSubject.count()).toBe(0);
  });

  it('keeps an existing link when its subject is archived later', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const subject = await createSubject(owner.client, workspace.id, { name: 'Mathematics' });
    const schoolClass = await createClass(owner.client, workspace.id);
    const path = `/workspaces/${workspace.id}/classes/${schoolClass.id}/subjects`;

    await put(owner.client, path)
      .send({ subjectIds: [subject.id] })
      .expect(200);

    await patch(owner.client, `/workspaces/${workspace.id}/subjects/${subject.id}`)
      .send({ status: 'ARCHIVED' })
      .expect(200);

    const saved = await put(owner.client, path).send({ subjectIds: [subject.id] });

    expect(saved.status).toBe(200);
    expect(saved.body.items.map((row: { id: string }) => row.id)).toEqual([subject.id]);
  });

  it('gives teachers read access while students and outsiders are refused', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const teacher = await addMember(owner.client, workspace.id, 'teacher@example.com');
    const student = await addMember(owner.client, workspace.id, 'student@example.com', 'STUDENT');
    const outsider = await registerVerifiedUser(context, 'outsider@example.com');

    await createSubject(owner.client, workspace.id, { name: 'Mathematics' });

    const teacherRead = await teacher.client.get(`/api/v1/workspaces/${workspace.id}/subjects`);

    expect(teacherRead.status).toBe(200);
    expect(teacherRead.body.total).toBe(1);

    const teacherWrite = await post(teacher.client, `/workspaces/${workspace.id}/subjects`).send({
      name: 'Science',
    });

    expect(teacherWrite.status).toBe(403);

    const studentRead = await student.client.get(`/api/v1/workspaces/${workspace.id}/subjects`);
    const outsiderRead = await outsider.client.get(`/api/v1/workspaces/${workspace.id}/subjects`);

    expect(studentRead.status).toBe(403);
    expect(outsiderRead.status).toBe(403);
  });

  it('keeps subject catalogues isolated between workspaces', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const outsider = await registerVerifiedUser(context, 'outsider@example.com');
    const workspace = await createWorkspace(owner.client, 'First', 'INSTITUTE');
    const otherWorkspace = await createWorkspace(outsider.client, 'Second', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const otherSubject = await createSubject(outsider.client, otherWorkspace.id, {
      name: 'Other Mathematics',
    });

    const crossLink = await put(
      owner.client,
      `/workspaces/${workspace.id}/classes/${schoolClass.id}/subjects`,
    ).send({ subjectIds: [otherSubject.id] });

    expect(crossLink.status).toBe(404);

    const otherList = await outsider.client.get(`/api/v1/workspaces/${otherWorkspace.id}/subjects`);

    expect(otherList.body.total).toBe(1);

    const crossRead = await owner.client.get(`/api/v1/workspaces/${otherWorkspace.id}/subjects`);

    expect(crossRead.status).toBe(403);
  });
});
