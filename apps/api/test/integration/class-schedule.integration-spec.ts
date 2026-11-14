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

describe('Class schedule integration', () => {
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

  async function createSubject(client: Client, workspaceId: string, name = 'Mathematics') {
    const response = await post(client, `/workspaces/${workspaceId}/subjects`).send({ name });

    expect(response.status).toBe(201);

    return response.body as { id: string; name: string; status: string };
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

  function schedulePath(workspaceId: string, classId: string) {
    return `/workspaces/${workspaceId}/classes/${classId}/schedule`;
  }

  async function setupClassroom(client: Client, workspaceId: string, name = 'Grade 8 Science') {
    const schoolClass = await createClass(client, workspaceId, name);
    const subject = await createSubject(client, workspaceId, `${name} Subject`);

    await linkSubject(client, workspaceId, schoolClass.id, [subject.id]);

    return { schoolClass, subject };
  }

  it('creates a weekly timetable and orders it by day and start time', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    await addMember(owner.client, workspace.id, 'teacher@example.com');
    const teacherId = await membershipIdFor(owner.client, workspace.id, 'teacher@example.com');
    const { schoolClass, subject } = await setupClassroom(owner.client, workspace.id);

    const later = await post(owner.client, schedulePath(workspace.id, schoolClass.id)).send({
      subjectId: subject.id,
      membershipId: teacherId,
      dayOfWeek: 'WEDNESDAY',
      startMinutes: 540,
      endMinutes: 600,
      room: 'Room 12',
    });

    expect(later.status).toBe(201);
    expect(later.body).toMatchObject({
      classId: schoolClass.id,
      subjectId: subject.id,
      membershipId: teacherId,
      dayOfWeek: 'WEDNESDAY',
      startMinutes: 540,
      endMinutes: 600,
      room: 'Room 12',
      subject: { id: subject.id, name: 'Grade 8 Science Subject' },
      membership: { id: teacherId, user: { firstName: 'Test' } },
    });

    const earlier = await post(owner.client, schedulePath(workspace.id, schoolClass.id)).send({
      subjectId: subject.id,
      dayOfWeek: 'MONDAY',
      startMinutes: 480,
      endMinutes: 540,
      room: '   ',
    });

    expect(earlier.status).toBe(201);
    expect(earlier.body.room).toBeNull();
    expect(earlier.body.membership).toBeNull();

    const list = await owner.client.get(`/api/v1${schedulePath(workspace.id, schoolClass.id)}`);

    expect(list.status).toBe(200);
    expect(list.body.items.map((slot: { dayOfWeek: string }) => slot.dayOfWeek)).toEqual([
      'MONDAY',
      'WEDNESDAY',
    ]);

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'CLASS_SCHEDULE_SLOT_CREATED', workspaceId: workspace.id },
      }),
    ).toBe(2);
  });

  it('rejects overlapping slots but allows back-to-back ones', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const { schoolClass, subject } = await setupClassroom(owner.client, workspace.id);
    const path = schedulePath(workspace.id, schoolClass.id);

    const base = {
      subjectId: subject.id,
      dayOfWeek: 'MONDAY',
      startMinutes: 540,
      endMinutes: 600,
    };

    await post(owner.client, path).send(base).expect(201);

    const overlapping = await post(owner.client, path).send({
      ...base,
      startMinutes: 570,
      endMinutes: 630,
    });

    expect(overlapping.status).toBe(409);

    await post(owner.client, path)
      .send({ ...base, startMinutes: 600, endMinutes: 660 })
      .expect(201);

    await post(owner.client, path)
      .send({ ...base, dayOfWeek: 'TUESDAY', startMinutes: 570, endMinutes: 630 })
      .expect(201);

    expect(await context.prisma.classScheduleSlot.count()).toBe(3);
  });

  it('prevents a teacher from being double-booked across classes', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    await addMember(owner.client, workspace.id, 'teacher@example.com');
    const teacherId = await membershipIdFor(owner.client, workspace.id, 'teacher@example.com');
    const first = await setupClassroom(owner.client, workspace.id, 'Class One');
    const second = await setupClassroom(owner.client, workspace.id, 'Class Two');

    await post(owner.client, schedulePath(workspace.id, first.schoolClass.id))
      .send({
        subjectId: first.subject.id,
        membershipId: teacherId,
        dayOfWeek: 'MONDAY',
        startMinutes: 540,
        endMinutes: 600,
      })
      .expect(201);

    const clash = await post(owner.client, schedulePath(workspace.id, second.schoolClass.id)).send({
      subjectId: second.subject.id,
      membershipId: teacherId,
      dayOfWeek: 'MONDAY',
      startMinutes: 570,
      endMinutes: 630,
    });

    expect(clash.status).toBe(409);

    await post(owner.client, schedulePath(workspace.id, second.schoolClass.id))
      .send({
        subjectId: second.subject.id,
        dayOfWeek: 'MONDAY',
        startMinutes: 570,
        endMinutes: 630,
      })
      .expect(201);
  });

  it('validates subjects, teachers and time ranges', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    await addMember(owner.client, workspace.id, 'teacher@example.com');
    await addMember(owner.client, workspace.id, 'student@example.com', 'STUDENT');
    const teacherId = await membershipIdFor(owner.client, workspace.id, 'teacher@example.com');
    const studentId = await membershipIdFor(owner.client, workspace.id, 'student@example.com');
    const schoolClass = await createClass(owner.client, workspace.id);
    const subject = await createSubject(owner.client, workspace.id);
    const path = schedulePath(workspace.id, schoolClass.id);

    const base = {
      subjectId: subject.id,
      dayOfWeek: 'MONDAY',
      startMinutes: 540,
      endMinutes: 600,
    };

    const unlinked = await post(owner.client, path).send(base);

    expect(unlinked.status).toBe(400);

    await linkSubject(owner.client, workspace.id, schoolClass.id, [subject.id]);

    await patch(owner.client, `/workspaces/${workspace.id}/subjects/${subject.id}`)
      .send({ status: 'ARCHIVED' })
      .expect(200);

    expect((await post(owner.client, path).send(base)).status).toBe(409);

    const activeSubject = await createSubject(owner.client, workspace.id, 'Science');
    await linkSubject(owner.client, workspace.id, schoolClass.id, [subject.id, activeSubject.id]);

    expect((await post(owner.client, path).send(base)).status).toBe(409);

    const active = { ...base, subjectId: activeSubject.id };

    expect(
      (
        await post(owner.client, path).send({
          ...active,
          membershipId: studentId,
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await post(owner.client, path).send({
          ...active,
          membershipId: '11111111-1111-4111-8111-111111111111',
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await post(owner.client, path).send({
          ...active,
          startMinutes: 600,
          endMinutes: 600,
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await post(owner.client, path).send({
          ...active,
          endMinutes: 1441,
        })
      ).status,
    ).toBe(400);

    const outsider = await registerVerifiedUser(context, 'outsider@example.com');
    const otherWorkspace = await createWorkspace(outsider.client, 'Other', 'INSTITUTE');
    const foreignSubject = await createSubject(outsider.client, otherWorkspace.id, 'History');

    expect(
      (
        await post(owner.client, path).send({
          ...active,
          subjectId: foreignSubject.id,
        })
      ).status,
    ).toBe(400);

    await post(owner.client, path)
      .send({ ...active, membershipId: teacherId })
      .expect(201);

    expect(await context.prisma.classScheduleSlot.count()).toBe(1);
  });

  it('updates and removes slots with audit events', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const { schoolClass, subject } = await setupClassroom(owner.client, workspace.id);
    const path = schedulePath(workspace.id, schoolClass.id);

    const created = await post(owner.client, path).send({
      subjectId: subject.id,
      dayOfWeek: 'MONDAY',
      startMinutes: 540,
      endMinutes: 600,
      room: 'Room 1',
    });

    expect(created.status).toBe(201);

    const other = await post(owner.client, path).send({
      subjectId: subject.id,
      dayOfWeek: 'TUESDAY',
      startMinutes: 540,
      endMinutes: 600,
    });

    expect(other.status).toBe(201);

    const updated = await patch(owner.client, `${path}/${created.body.id}`).send({
      dayOfWeek: 'TUESDAY',
      startMinutes: 600,
      endMinutes: 660,
      room: 'Lab 2',
    });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      dayOfWeek: 'TUESDAY',
      startMinutes: 600,
      endMinutes: 660,
      room: 'Lab 2',
    });

    const clash = await patch(owner.client, `${path}/${other.body.id}`).send({
      startMinutes: 630,
      endMinutes: 660,
    });

    expect(clash.status).toBe(409);

    const otherClass = await setupClassroom(owner.client, workspace.id, 'Other Class');

    const crossClass = await del(
      owner.client,
      `${schedulePath(workspace.id, otherClass.schoolClass.id)}/${created.body.id}`,
    );

    expect(crossClass.status).toBe(404);

    await del(owner.client, `${path}/${created.body.id}`).expect(200);

    const list = await owner.client.get(`/api/v1${path}`);

    expect(list.body.items.map((slot: { id: string }) => slot.id)).toEqual([other.body.id]);

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'CLASS_SCHEDULE_SLOT_UPDATED', workspaceId: workspace.id },
      }),
    ).toBe(1);

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'CLASS_SCHEDULE_SLOT_DELETED', workspaceId: workspace.id },
      }),
    ).toBe(1);
  });

  it('blocks timetable changes on archived classes', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const { schoolClass, subject } = await setupClassroom(owner.client, workspace.id);
    const path = schedulePath(workspace.id, schoolClass.id);

    const created = await post(owner.client, path).send({
      subjectId: subject.id,
      dayOfWeek: 'MONDAY',
      startMinutes: 540,
      endMinutes: 600,
    });

    expect(created.status).toBe(201);

    await patch(owner.client, `/workspaces/${workspace.id}/classes/${schoolClass.id}`)
      .send({ status: 'ARCHIVED' })
      .expect(200);

    expect(
      (
        await post(owner.client, path).send({
          subjectId: subject.id,
          dayOfWeek: 'TUESDAY',
          startMinutes: 540,
          endMinutes: 600,
        })
      ).status,
    ).toBe(409);

    expect(
      (await patch(owner.client, `${path}/${created.body.id}`).send({ room: 'Lab 2' })).status,
    ).toBe(409);

    expect((await del(owner.client, `${path}/${created.body.id}`)).status).toBe(409);

    await owner.client.get(`/api/v1${path}`).expect(200);
  });

  it('gives teachers read access while students and outsiders are refused', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const teacher = await addMember(owner.client, workspace.id, 'teacher@example.com');
    const student = await addMember(owner.client, workspace.id, 'student@example.com', 'STUDENT');
    const outsider = await registerVerifiedUser(context, 'outsider@example.com');
    const { schoolClass, subject } = await setupClassroom(owner.client, workspace.id);
    const path = schedulePath(workspace.id, schoolClass.id);

    await post(owner.client, path)
      .send({
        subjectId: subject.id,
        dayOfWeek: 'MONDAY',
        startMinutes: 540,
        endMinutes: 600,
      })
      .expect(201);

    const readable = await teacher.client.get(`/api/v1${path}`);

    expect(readable.status).toBe(200);
    expect(readable.body.items).toHaveLength(1);

    expect(
      (
        await post(teacher.client, path).send({
          subjectId: subject.id,
          dayOfWeek: 'TUESDAY',
          startMinutes: 540,
          endMinutes: 600,
        })
      ).status,
    ).toBe(403);

    expect((await student.client.get(`/api/v1${path}`)).status).toBe(403);
    expect((await outsider.client.get(`/api/v1${path}`)).status).toBe(403);
  });

  it('enforces the exclusion constraint at the database level', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const { schoolClass, subject } = await setupClassroom(owner.client, workspace.id);

    await context.prisma.classScheduleSlot.create({
      data: {
        workspaceId: workspace.id,
        classId: schoolClass.id,
        subjectId: subject.id,
        dayOfWeek: 'MONDAY',
        startMinutes: 540,
        endMinutes: 600,
      },
    });

    let failure: unknown;

    try {
      await context.prisma.classScheduleSlot.create({
        data: {
          workspaceId: workspace.id,
          classId: schoolClass.id,
          subjectId: subject.id,
          dayOfWeek: 'MONDAY',
          startMinutes: 570,
          endMinutes: 630,
        },
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeDefined();

    const shape = failure as { code?: string; meta?: unknown; message?: string };

    expect(shape.code).toBe('P2039');
    expect(`${JSON.stringify(shape.meta ?? {})} ${shape.message}`).toContain(
      'class_schedule_slots_no_class_overlap',
    );
    expect(JSON.stringify(shape.meta)).toContain('23P01');

    await context.prisma.classScheduleSlot.create({
      data: {
        workspaceId: workspace.id,
        classId: schoolClass.id,
        subjectId: subject.id,
        dayOfWeek: 'MONDAY',
        startMinutes: 600,
        endMinutes: 660,
      },
    });

    expect(
      await context.prisma.classScheduleSlot.count({ where: { classId: schoolClass.id } }),
    ).toBe(2);
  });
});
