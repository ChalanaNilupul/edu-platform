import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createTestContext,
  createWorkspace,
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

const REGISTER_DATE = '2026-11-10';

describe('Attendance integration', () => {
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

  async function enrollStudent(
    client: Client,
    workspaceId: string,
    classId: string,
    firstName: string,
  ) {
    const student = await post(client, `/workspaces/${workspaceId}/students`).send({ firstName });

    expect(student.status).toBe(201);

    const enrollment = await post(
      client,
      `/workspaces/${workspaceId}/classes/${classId}/enrollments`,
    ).send({ studentId: student.body.id });

    expect(enrollment.status).toBe(201);

    return {
      student: student.body as { id: string; firstName: string },
      enrollment: enrollment.body,
    };
  }

  function attendancePath(workspaceId: string, classId: string, date?: string) {
    const path = `/workspaces/${workspaceId}/classes/${classId}/attendance`;

    return date ? `${path}?date=${date}` : path;
  }

  it('records a daily register and returns it with the active roster', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const amara = await enrollStudent(owner.client, workspace.id, schoolClass.id, 'Amara');
    const binod = await enrollStudent(owner.client, workspace.id, schoolClass.id, 'Binod');
    const path = attendancePath(workspace.id, schoolClass.id);

    const empty = await owner.client.get(
      `/api/v1${attendancePath(workspace.id, schoolClass.id, REGISTER_DATE)}`,
    );

    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({
      date: REGISTER_DATE,
      session: null,
      counts: { present: 0, absent: 0, late: 0, excused: 0, unmarked: 2 },
    });
    expect(empty.body.students.map((student: { firstName: string }) => student.firstName)).toEqual([
      'Amara',
      'Binod',
    ]);
    expect(empty.body.students[0]).toMatchObject({ status: null, note: null });

    const saved = await put(owner.client, path).send({
      date: REGISTER_DATE,
      records: [
        { studentId: amara.student.id, status: 'PRESENT' },
        { studentId: binod.student.id, status: 'LATE', note: '   ' },
      ],
    });

    expect(saved.status).toBe(200);
    expect(saved.body.session).toMatchObject({
      classId: schoolClass.id,
      date: REGISTER_DATE,
      recordedBy: { membershipId: expect.any(String), name: 'Test' },
    });
    expect(
      saved.body.students.map((student: { status: string; note: string | null }) => [
        student.status,
        student.note,
      ]),
    ).toEqual([
      ['PRESENT', null],
      ['LATE', null],
    ]);
    expect(saved.body.counts).toMatchObject({ present: 1, late: 1, unmarked: 0 });

    const reread = await owner.client.get(
      `/api/v1${attendancePath(workspace.id, schoolClass.id, REGISTER_DATE)}`,
    );

    expect(reread.status).toBe(200);
    expect(reread.body.session.id).toBe(saved.body.session.id);
    expect(reread.body.counts.present).toBe(1);

    const otherDay = await owner.client.get(
      `/api/v1${attendancePath(workspace.id, schoolClass.id, '2026-11-11')}`,
    );

    expect(otherDay.body.session).toBeNull();
    expect(otherDay.body.counts.unmarked).toBe(2);

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'ATTENDANCE_RECORDED', workspaceId: workspace.id },
      }),
    ).toBe(1);
  });

  it('corrects a saved register and keeps records of students who later leave', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const amara = await enrollStudent(owner.client, workspace.id, schoolClass.id, 'Amara');
    const binod = await enrollStudent(owner.client, workspace.id, schoolClass.id, 'Binod');
    const path = attendancePath(workspace.id, schoolClass.id);

    const first = [
      { studentId: amara.student.id, status: 'PRESENT' },
      { studentId: binod.student.id, status: 'ABSENT', note: 'Sick' },
    ];

    await put(owner.client, path).send({ date: REGISTER_DATE, records: first }).expect(200);

    const corrected = await put(owner.client, path).send({
      date: REGISTER_DATE,
      records: [
        { studentId: amara.student.id, status: 'LATE', note: 'Arrived at 8:20' },
        { studentId: binod.student.id, status: 'ABSENT', note: 'Sick' },
      ],
    });

    expect(corrected.status).toBe(200);
    expect(corrected.body.students[0]).toMatchObject({
      status: 'LATE',
      note: 'Arrived at 8:20',
    });

    await put(owner.client, path)
      .send({
        date: REGISTER_DATE,
        records: [
          { studentId: amara.student.id, status: 'LATE', note: 'Arrived at 8:20' },
          { studentId: binod.student.id, status: 'ABSENT', note: 'Sick' },
        ],
      })
      .expect(200);

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'ATTENDANCE_RECORDED', workspaceId: workspace.id },
      }),
    ).toBe(1);
    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'ATTENDANCE_UPDATED', workspaceId: workspace.id },
      }),
    ).toBe(1);

    await patch(owner.client, `/workspaces/${workspace.id}/enrollments/${binod.enrollment.id}`)
      .send({ status: 'WITHDRAWN' })
      .expect(200);

    const roster = await owner.client.get(
      `/api/v1${attendancePath(workspace.id, schoolClass.id, REGISTER_DATE)}`,
    );

    expect(roster.body.students).toHaveLength(1);
    expect(roster.body.students[0].studentId).toBe(amara.student.id);

    await put(owner.client, path)
      .send({
        date: REGISTER_DATE,
        records: [{ studentId: amara.student.id, status: 'PRESENT' }],
      })
      .expect(200);

    expect(
      await context.prisma.attendanceRecord.count({ where: { workspaceId: workspace.id } }),
    ).toBe(2);
  });

  it('validates dates, duplicate students and roster membership', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const amara = await enrollStudent(owner.client, workspace.id, schoolClass.id, 'Amara');
    const outsideClass = await enrollStudent(owner.client, workspace.id, schoolClass.id, 'Kumari');
    const path = attendancePath(workspace.id, schoolClass.id);

    await patch(
      owner.client,
      `/workspaces/${workspace.id}/enrollments/${outsideClass.enrollment.id}`,
    )
      .send({ status: 'WITHDRAWN' })
      .expect(200);

    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    expect(
      (
        await put(owner.client, path).send({
          date: future,
          records: [{ studentId: amara.student.id, status: 'PRESENT' }],
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await put(owner.client, path).send({
          date: '2026-02-31',
          records: [{ studentId: amara.student.id, status: 'PRESENT' }],
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await put(owner.client, path).send({
          date: REGISTER_DATE,
          records: [
            { studentId: amara.student.id, status: 'PRESENT' },
            { studentId: amara.student.id, status: 'ABSENT' },
          ],
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await put(owner.client, path).send({
          date: REGISTER_DATE,
          records: [{ studentId: outsideClass.student.id, status: 'PRESENT' }],
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await put(owner.client, path).send({
          date: REGISTER_DATE,
          records: [{ studentId: '11111111-1111-4111-8111-111111111111', status: 'PRESENT' }],
        })
      ).status,
    ).toBe(400);

    expect(await context.prisma.attendanceSession.count()).toBe(0);
    expect(await context.prisma.attendanceRecord.count()).toBe(0);
  });

  it('blocks registers on archived classes but still shows past ones', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const amara = await enrollStudent(owner.client, workspace.id, schoolClass.id, 'Amara');
    const path = attendancePath(workspace.id, schoolClass.id);

    await put(owner.client, path)
      .send({
        date: REGISTER_DATE,
        records: [{ studentId: amara.student.id, status: 'PRESENT' }],
      })
      .expect(200);

    await patch(owner.client, `/workspaces/${workspace.id}/classes/${schoolClass.id}`)
      .send({ status: 'ARCHIVED' })
      .expect(200);

    const blocked = await put(owner.client, path).send({
      date: '2026-11-11',
      records: [{ studentId: amara.student.id, status: 'ABSENT' }],
    });

    expect(blocked.status).toBe(409);

    const history = await owner.client.get(
      `/api/v1${attendancePath(workspace.id, schoolClass.id, REGISTER_DATE)}`,
    );

    expect(history.status).toBe(200);
    expect(history.body.students[0].status).toBe('PRESENT');
  });

  it('lets assigned teachers write registers while other teachers and students cannot', async () => {
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
    const amara = await enrollStudent(owner.client, workspace.id, schoolClass.id, 'Amara');
    const path = attendancePath(workspace.id, schoolClass.id);

    await post(owner.client, `/workspaces/${workspace.id}/classes/${schoolClass.id}/teachers`)
      .send({ membershipId: teacherId, isPrimary: true })
      .expect(201);

    const saved = await put(teacher.client, path).send({
      date: REGISTER_DATE,
      records: [{ studentId: amara.student.id, status: 'EXCUSED', note: 'Medical note' }],
    });

    expect(saved.status).toBe(200);
    expect(saved.body.session.recordedBy.membershipId).toBe(teacherId);

    const readable = await otherTeacher.client.get(
      `/api/v1${attendancePath(workspace.id, schoolClass.id, REGISTER_DATE)}`,
    );

    expect(readable.status).toBe(200);
    expect(readable.body.students[0].status).toBe('EXCUSED');

    expect(
      (
        await put(otherTeacher.client, path).send({
          date: '2026-11-11',
          records: [{ studentId: amara.student.id, status: 'PRESENT' }],
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await studentMember.client.get(
          `/api/v1${attendancePath(workspace.id, schoolClass.id, REGISTER_DATE)}`,
        )
      ).status,
    ).toBe(403);

    const outsider = await registerVerifiedUser(context, 'outsider@example.com');

    expect(
      (
        await outsider.client.get(
          `/api/v1${attendancePath(workspace.id, schoolClass.id, REGISTER_DATE)}`,
        )
      ).status,
    ).toBe(403);
  });

  it('scopes registers to the workspace', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const amara = await enrollStudent(owner.client, workspace.id, schoolClass.id, 'Amara');

    await put(owner.client, attendancePath(workspace.id, schoolClass.id))
      .send({
        date: REGISTER_DATE,
        records: [{ studentId: amara.student.id, status: 'PRESENT' }],
      })
      .expect(200);

    const other = await registerVerifiedUser(context, 'other@example.com');
    const otherWorkspace = await createWorkspace(other.client, 'Other', 'INSTITUTE');

    expect(
      (
        await other.client.get(
          `/api/v1${attendancePath(otherWorkspace.id, schoolClass.id, REGISTER_DATE)}`,
        )
      ).status,
    ).toBe(404);

    expect(
      await context.prisma.attendanceSession.count({ where: { workspaceId: workspace.id } }),
    ).toBe(1);
  });
});
