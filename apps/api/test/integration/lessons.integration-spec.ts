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

describe('Lessons integration', () => {
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

  async function createSubject(client: Client, workspaceId: string, name = 'Science') {
    const response = await post(client, `/workspaces/${workspaceId}/subjects`).send({ name });

    expect(response.status).toBe(201);

    return response.body as { id: string; name: string };
  }

  async function linkSubject(
    client: Client,
    workspaceId: string,
    classId: string,
    subjectIds: string[],
  ) {
    await put(client, `/workspaces/${workspaceId}/classes/${classId}/subjects`)
      .send({ subjectIds })
      .expect(200);
  }

  async function createLesson(
    client: Client,
    workspaceId: string,
    classId: string,
    body: Record<string, unknown> = {},
  ) {
    const response = await post(
      client,
      `/workspaces/${workspaceId}/classes/${classId}/lessons`,
    ).send({ title: 'Fractions', lessonDate: '2026-11-10', ...body });

    expect(response.status).toBe(201);

    return response.body as {
      id: string;
      classId: string;
      title: string;
      status: string;
      lessonDate: string;
      materialCount: number;
      materials: unknown[];
    };
  }

  it('creates a draft lesson, lists it and records the audit event', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const subject = await createSubject(owner.client, workspace.id);

    await linkSubject(owner.client, workspace.id, schoolClass.id, [subject.id]);

    const created = await createLesson(owner.client, workspace.id, schoolClass.id, {
      description: 'Introduction to fractions',
      subjectId: subject.id,
    });

    expect(created).toMatchObject({
      classId: schoolClass.id,
      title: 'Fractions',
      status: 'DRAFT',
      lessonDate: '2026-11-10',
      materialCount: 0,
      materials: [],
    });

    const list = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/classes/${schoolClass.id}/lessons`,
    );

    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toMatchObject({ id: created.id, materialCount: 0 });

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'LESSON_CREATED', workspaceId: workspace.id, targetId: created.id },
      }),
    ).toBe(1);
  });

  it('lists lessons across classes with filters and class summaries', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const classA = await createClass(owner.client, workspace.id, 'Grade 8');
    const classB = await createClass(owner.client, workspace.id, 'Grade 9');

    const published = await createLesson(owner.client, workspace.id, classA.id, {
      title: 'Algebra',
      status: 'PUBLISHED',
    });
    const draft = await createLesson(owner.client, workspace.id, classB.id, { title: 'Geometry' });

    const all = await owner.client.get(`/api/v1/workspaces/${workspace.id}/lessons`);

    expect(all.status).toBe(200);
    expect(all.body.total).toBe(2);
    expect(
      (all.body.items as { class: { name: string } }[]).map((item) => item.class.name).sort(),
    ).toEqual(['Grade 8', 'Grade 9']);

    const drafts = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/lessons?status=DRAFT`,
    );

    expect(drafts.status).toBe(200);
    expect((drafts.body.items as { id: string }[]).map((item) => item.id)).toEqual([draft.id]);

    const byClass = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/lessons?classId=${classA.id}`,
    );

    expect(byClass.status).toBe(200);
    expect(byClass.body.items).toHaveLength(1);
    expect(byClass.body.items[0]).toMatchObject({
      id: published.id,
      class: { id: classA.id },
    });

    const outsider = await registerVerifiedUser(context, 'outsider@example.com');
    await createWorkspace(outsider.client, 'Other', 'INSTITUTE');

    const denied = await outsider.client.get(`/api/v1/workspaces/${workspace.id}/lessons`);

    expect(denied.status).toBe(403);
  });

  it('rejects invalid dates, unlinked subjects and unknown fields', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const subject = await createSubject(owner.client, workspace.id);

    const path = `/workspaces/${workspace.id}/classes/${schoolClass.id}/lessons`;

    for (const body of [
      {},
      { title: '   ', lessonDate: '2026-11-10' },
      { title: 'Fractions', lessonDate: '10-11-2026' },
      { title: 'Fractions', lessonDate: '2026-02-30' },
      { title: 'Fractions', lessonDate: '2026-11-10', unknown: true },
    ]) {
      await post(owner.client, path).send(body).expect(400);
    }

    await post(owner.client, path)
      .send({ title: 'Fractions', lessonDate: '2026-11-10', subjectId: subject.id })
      .expect(400);

    expect(await context.prisma.lesson.count()).toBe(0);
  });

  it('lets managers and assigned teachers write while other staff are read-only', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const teacher = await addMember(owner.client, workspace.id, 'teacher@example.com');
    const otherTeacher = await addMember(owner.client, workspace.id, 'other@example.com');
    const studentMember = await addMember(
      owner.client,
      workspace.id,
      'student@example.com',
      'STUDENT',
    );
    const teacherId = await membershipIdFor(owner.client, workspace.id, 'teacher@example.com');
    const schoolClass = await createClass(owner.client, workspace.id);

    await post(owner.client, `/workspaces/${workspace.id}/classes/${schoolClass.id}/teachers`)
      .send({ membershipId: teacherId, isPrimary: true })
      .expect(201);

    const created = await createLesson(teacher.client, workspace.id, schoolClass.id);

    await patch(teacher.client, `/workspaces/${workspace.id}/lessons/${created.id}`)
      .send({ status: 'PUBLISHED' })
      .expect(200);

    const readable = await otherTeacher.client.get(
      `/api/v1/workspaces/${workspace.id}/lessons/${created.id}`,
    );

    expect(readable.status).toBe(200);
    expect(readable.body.status).toBe('PUBLISHED');

    await post(otherTeacher.client, `/workspaces/${workspace.id}/classes/${schoolClass.id}/lessons`)
      .send({ title: 'Intruder', lessonDate: '2026-11-11' })
      .expect(403);

    await patch(otherTeacher.client, `/workspaces/${workspace.id}/lessons/${created.id}`)
      .send({ title: 'Intruder' })
      .expect(403);

    await del(otherTeacher.client, `/workspaces/${workspace.id}/lessons/${created.id}`).expect(403);

    expect(
      (
        await studentMember.client.get(
          `/api/v1/workspaces/${workspace.id}/classes/${schoolClass.id}/lessons`,
        )
      ).status,
    ).toBe(403);

    await del(teacher.client, `/workspaces/${workspace.id}/lessons/${created.id}`).expect(204);

    expect(await context.prisma.lesson.count()).toBe(0);
  });

  it('blocks new lessons for archived classes but keeps existing ones editable', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const created = await createLesson(owner.client, workspace.id, schoolClass.id);

    await patch(owner.client, `/workspaces/${workspace.id}/classes/${schoolClass.id}`)
      .send({ status: 'ARCHIVED' })
      .expect(200);

    await post(owner.client, `/workspaces/${workspace.id}/classes/${schoolClass.id}/lessons`)
      .send({ title: 'New lesson', lessonDate: '2026-11-12' })
      .expect(409);

    await patch(owner.client, `/workspaces/${workspace.id}/lessons/${created.id}`)
      .send({ description: 'Still editable' })
      .expect(200);
  });

  it('adds, updates and removes materials with audit events', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const lesson = await createLesson(owner.client, workspace.id, schoolClass.id);

    const pdf = await post(
      owner.client,
      `/workspaces/${workspace.id}/lessons/${lesson.id}/materials`,
    )
      .send({
        title: 'Fractions worksheet',
        kind: 'PDF',
        url: 'https://example.com/fractions.pdf',
        description: 'Homework',
      })
      .expect(201);

    expect(pdf.body).toMatchObject({
      lessonId: lesson.id,
      kind: 'PDF',
      url: 'https://example.com/fractions.pdf',
    });

    await post(owner.client, `/workspaces/${workspace.id}/lessons/${lesson.id}/materials`)
      .send({ title: 'Fractions video', kind: 'VIDEO', url: 'https://example.com/watch?v=1' })
      .expect(201);

    for (const body of [
      { title: 'Broken', kind: 'PDF', url: 'not-a-url' },
      { title: 'Broken', kind: 'PDF', url: 'ftp://example.com/file.pdf' },
      { title: 'Broken', kind: 'FILE', url: 'https://example.com/file.pdf' },
      { title: 'Broken', url: 'https://example.com/file.pdf' },
    ]) {
      await post(owner.client, `/workspaces/${workspace.id}/lessons/${lesson.id}/materials`)
        .send(body)
        .expect(400);
    }

    const updated = await patch(
      owner.client,
      `/workspaces/${workspace.id}/materials/${pdf.body.id}`,
    )
      .send({ title: 'Fractions worksheet v2', kind: 'LINK' })
      .expect(200);

    expect(updated.body).toMatchObject({ title: 'Fractions worksheet v2', kind: 'LINK' });

    const detail = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/lessons/${lesson.id}`,
    );

    expect(detail.body.materialCount).toBe(2);
    expect(detail.body.materials).toHaveLength(2);

    expect(
      await context.prisma.auditEvent.count({
        where: {
          type: 'LESSON_MATERIAL_CREATED',
          workspaceId: workspace.id,
          targetId: pdf.body.id,
        },
      }),
    ).toBe(1);

    expect(
      await context.prisma.auditEvent.count({
        where: {
          type: 'LESSON_MATERIAL_UPDATED',
          workspaceId: workspace.id,
          targetId: pdf.body.id,
        },
      }),
    ).toBe(1);

    await del(owner.client, `/workspaces/${workspace.id}/materials/${pdf.body.id}`).expect(204);

    expect(
      await context.prisma.auditEvent.count({
        where: {
          type: 'LESSON_MATERIAL_DELETED',
          workspaceId: workspace.id,
          targetId: pdf.body.id,
        },
      }),
    ).toBe(1);
    expect(await context.prisma.lessonMaterial.count()).toBe(1);
  });

  it('deletes materials with their lesson and scopes lessons to the workspace', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const lesson = await createLesson(owner.client, workspace.id, schoolClass.id);

    await post(owner.client, `/workspaces/${workspace.id}/lessons/${lesson.id}/materials`)
      .send({ title: 'Slides', kind: 'LINK', url: 'https://example.com/slides' })
      .expect(201);

    const other = await registerVerifiedUser(context, 'other@example.com');
    const otherWorkspace = await createWorkspace(other.client, 'Other', 'INSTITUTE');

    expect(
      (
        await other.client.get(
          `/api/v1/workspaces/${otherWorkspace.id}/classes/${schoolClass.id}/lessons`,
        )
      ).status,
    ).toBe(404);

    expect(
      (await other.client.get(`/api/v1/workspaces/${otherWorkspace.id}/lessons/${lesson.id}`))
        .status,
    ).toBe(404);

    await post(other.client, `/workspaces/${otherWorkspace.id}/classes/${schoolClass.id}/lessons`)
      .send({ title: 'Intruder', lessonDate: '2026-11-11' })
      .expect(404);

    await del(owner.client, `/workspaces/${workspace.id}/lessons/${lesson.id}`).expect(204);

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'LESSON_DELETED', workspaceId: workspace.id, targetId: lesson.id },
      }),
    ).toBe(1);
    expect(await context.prisma.lessonMaterial.count()).toBe(0);
  });
});
