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

describe('Finance integration', () => {
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

  async function createClass(client: Client, workspaceId: string, name = 'Grade 8') {
    const response = await post(client, `/workspaces/${workspaceId}/classes`).send({ name });

    expect(response.status).toBe(201);

    return response.body as { id: string; name: string; status: string };
  }

  async function createStudent(client: Client, workspaceId: string, firstName: string) {
    const response = await post(client, `/workspaces/${workspaceId}/students`).send({ firstName });

    expect(response.status).toBe(201);

    return response.body as { id: string; firstName: string };
  }

  async function enroll(client: Client, workspaceId: string, classId: string, studentId: string) {
    const response = await post(client, `/workspaces/${workspaceId}/classes/${classId}/enrollments`)
      .send({ studentId })
      .expect(201);

    return response.body as { id: string };
  }

  async function createPlan(
    client: Client,
    workspaceId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const response = await post(client, `/workspaces/${workspaceId}/finance/plans`).send({
      name: 'Monthly tuition',
      amount: '3500.00',
      dueDay: 5,
      ...overrides,
    });

    expect(response.status).toBe(201);

    return response.body as {
      id: string;
      name: string;
      amount: string;
      dueDay: number;
      status: string;
      classId: string | null;
      class: { id: string; name: string } | null;
    };
  }

  async function generate(client: Client, workspaceId: string, planId: string, period: string) {
    return post(client, `/workspaces/${workspaceId}/finance/plans/${planId}/generate`).send({
      period,
    });
  }

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

  it('creates plans and keeps names unique per workspace', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);

    const plan = await createPlan(owner.client, workspace.id, {
      classId: schoolClass.id,
      description: '  Grade 8 tuition  ',
    });

    expect(plan).toMatchObject({
      name: 'Monthly tuition',
      amount: '3500.00',
      dueDay: 5,
      status: 'ACTIVE',
      classId: schoolClass.id,
    });
    expect(plan.class?.name).toBe('Grade 8');

    const list = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/finance/plans?search=tuition`,
    );

    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].description).toBe('Grade 8 tuition');

    const duplicate = await post(owner.client, `/workspaces/${workspace.id}/finance/plans`).send({
      name: 'Monthly tuition',
      amount: '1000',
    });

    expect(duplicate.status).toBe(409);

    const archived = await patch(
      owner.client,
      `/workspaces/${workspace.id}/finance/plans/${plan.id}`,
    ).send({ status: 'ARCHIVED' });

    expect(archived.status).toBe(200);
    expect(archived.body.status).toBe('ARCHIVED');

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'FEE_PLAN_CREATED', workspaceId: workspace.id },
      }),
    ).toBe(1);
    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'FEE_PLAN_ARCHIVED', workspaceId: workspace.id },
      }),
    ).toBe(1);
  });

  it('generates fees once per student, period and plan', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const amara = await createStudent(owner.client, workspace.id, 'Amara');
    const binod = await createStudent(owner.client, workspace.id, 'Binod');
    const outside = await createStudent(owner.client, workspace.id, 'Kumari');

    await enroll(owner.client, workspace.id, schoolClass.id, amara.id);
    await enroll(owner.client, workspace.id, schoolClass.id, binod.id);

    const plan = await createPlan(owner.client, workspace.id, { classId: schoolClass.id });

    const first = await generate(owner.client, workspace.id, plan.id, '2026-11');

    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({
      period: '2026-11',
      periodLabel: 'November 2026',
      totalStudents: 2,
      created: 2,
      skipped: 0,
    });

    const again = await generate(owner.client, workspace.id, plan.id, '2026-11');

    expect(again.status).toBe(201);
    expect(again.body).toMatchObject({ created: 0, skipped: 2 });

    await enroll(owner.client, workspace.id, schoolClass.id, outside.id);

    const third = await generate(owner.client, workspace.id, plan.id, '2026-11');

    expect(third.body).toMatchObject({ totalStudents: 3, created: 1, skipped: 2 });

    const fees = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/finance/fees?month=2026-11`,
    );

    expect(fees.status).toBe(200);
    expect(fees.body.total).toBe(3);
    expect(fees.body.items[0]).toMatchObject({
      amount: '3500.00',
      paidAmount: '0.00',
      balance: '3500.00',
      status: 'UNPAID',
      periodMonth: '2026-11',
      dueDate: '2026-11-05',
      paymentCount: 0,
      classId: schoolClass.id,
    });
    expect(fees.body.items[0].description).toContain('November 2026');

    // A plan without a class bills every actively enrolled student.
    const allClasses = await createPlan(owner.client, workspace.id, { name: 'Annual levy' });
    const wholeSchool = await generate(owner.client, workspace.id, allClasses.id, '2026-12');

    expect(wholeSchool.body).toMatchObject({ totalStudents: 3, created: 3, skipped: 0 });

    await patch(owner.client, `/workspaces/${workspace.id}/classes/${schoolClass.id}`)
      .send({ status: 'ARCHIVED' })
      .expect(200);

    const blocked = await generate(owner.client, workspace.id, plan.id, '2027-01');

    expect(blocked.status).toBe(409);

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'STUDENT_FEES_GENERATED', workspaceId: workspace.id },
      }),
    ).toBe(4);
  });

  it('records payments, keeps balances in step and reverses them', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const amara = await createStudent(owner.client, workspace.id, 'Amara');

    const fee = await post(owner.client, `/workspaces/${workspace.id}/finance/fees`).send({
      studentId: amara.id,
      description: 'Admission fee',
      amount: '5000.00',
      dueDate: '2026-11-30',
      note: 'One-time',
    });

    expect(fee.status).toBe(201);
    expect(fee.body).toMatchObject({ balance: '5000.00', status: 'UNPAID' });

    const cash = await post(
      owner.client,
      `/workspaces/${workspace.id}/finance/fees/${fee.body.id}/payments`,
    ).send({ amount: '2000.00', method: 'CASH', paidAt: '2026-11-10', note: 'Front desk' });

    expect(cash.status).toBe(201);
    expect(cash.body.fee).toMatchObject({
      paidAmount: '2000.00',
      balance: '3000.00',
      status: 'PARTIAL',
    });
    expect(cash.body.payment).toMatchObject({ method: 'CASH', paidAt: '2026-11-10' });

    const bank = await post(
      owner.client,
      `/workspaces/${workspace.id}/finance/fees/${fee.body.id}/payments`,
    ).send({
      amount: '3000.00',
      method: 'BANK',
      paidAt: '2026-11-11',
      reference: 'SLIP-123',
    });

    expect(bank.status).toBe(201);
    expect(bank.body.fee).toMatchObject({
      paidAmount: '5000.00',
      balance: '0.00',
      status: 'PAID',
    });

    const overpaid = await post(
      owner.client,
      `/workspaces/${workspace.id}/finance/fees/${fee.body.id}/payments`,
    ).send({ amount: '1.00', method: 'CASH', paidAt: '2026-11-12' });

    expect(overpaid.status).toBe(400);

    const history = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/finance/fees/${fee.body.id}`,
    );

    expect(history.status).toBe(200);
    expect(history.body.payments).toHaveLength(2);
    expect(history.body.payments[0]).toMatchObject({ method: 'BANK', reference: 'SLIP-123' });
    expect(history.body.payments[0].recordedBy.name).toBe('Test');

    const removed = await del(
      owner.client,
      `/workspaces/${workspace.id}/finance/fees/${fee.body.id}/payments/${cash.body.payment.id}`,
    );

    expect(removed.status).toBe(204);

    const reread = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/finance/fees/${fee.body.id}`,
    );

    expect(reread.body).toMatchObject({
      paidAmount: '3000.00',
      balance: '2000.00',
      status: 'PARTIAL',
    });
    expect(reread.body.payments).toHaveLength(1);

    expect(
      (
        await del(
          owner.client,
          `/workspaces/${workspace.id}/finance/fees/${fee.body.id}/payments/${cash.body.payment.id}`,
        )
      ).status,
    ).toBe(404);

    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'PAYMENT_RECORDED', workspaceId: workspace.id },
      }),
    ).toBe(2);
    expect(
      await context.prisma.auditEvent.count({
        where: { type: 'PAYMENT_DELETED', workspaceId: workspace.id },
      }),
    ).toBe(1);
  });

  it('validates fee edits, future payments and voiding', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const amara = await createStudent(owner.client, workspace.id, 'Amara');

    const fee = await post(owner.client, `/workspaces/${workspace.id}/finance/fees`).send({
      studentId: amara.id,
      description: 'Admission fee',
      amount: '5000.00',
      dueDate: '2026-11-30',
    });

    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const futurePayment = await post(
      owner.client,
      `/workspaces/${workspace.id}/finance/fees/${fee.body.id}/payments`,
    ).send({ amount: '100.00', method: 'CASH', paidAt: future });

    expect(futurePayment.status).toBe(400);

    await post(owner.client, `/workspaces/${workspace.id}/finance/fees/${fee.body.id}/payments`)
      .send({ amount: '2000.00', method: 'CASH', paidAt: '2026-11-10' })
      .expect(201);

    const belowPaid = await patch(
      owner.client,
      `/workspaces/${workspace.id}/finance/fees/${fee.body.id}`,
    ).send({ amount: '1000.00' });

    expect(belowPaid.status).toBe(400);

    const blockedVoid = await patch(
      owner.client,
      `/workspaces/${workspace.id}/finance/fees/${fee.body.id}`,
    ).send({ status: 'VOID' });

    expect(blockedVoid.status).toBe(409);

    const otherFee = await post(owner.client, `/workspaces/${workspace.id}/finance/fees`).send({
      studentId: amara.id,
      description: 'Library fee',
      amount: '500.00',
      dueDate: '2026-12-31',
    });

    const voided = await patch(
      owner.client,
      `/workspaces/${workspace.id}/finance/fees/${otherFee.body.id}`,
    ).send({ status: 'VOID' });

    expect(voided.status).toBe(200);
    expect(voided.body.status).toBe('VOID');

    const afterVoid = await post(
      owner.client,
      `/workspaces/${workspace.id}/finance/fees/${otherFee.body.id}/payments`,
    ).send({ amount: '100.00', method: 'CASH', paidAt: '2026-11-12' });

    expect(afterVoid.status).toBe(409);

    const voidedList = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/finance/fees?status=VOID`,
    );

    expect(voidedList.body.total).toBe(1);
  });

  it('summarises billed, collected and outstanding balances', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const schoolClass = await createClass(owner.client, workspace.id);
    const amara = await createStudent(owner.client, workspace.id, 'Amara');
    const binod = await createStudent(owner.client, workspace.id, 'Binod');

    await enroll(owner.client, workspace.id, schoolClass.id, amara.id);
    await enroll(owner.client, workspace.id, schoolClass.id, binod.id);

    const plan = await createPlan(owner.client, workspace.id, { classId: schoolClass.id });
    const generated = await generate(owner.client, workspace.id, plan.id, '2026-11');

    expect(generated.status).toBe(201);

    const fees = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/finance/fees?month=2026-11`,
    );
    const [first, second] = fees.body.items as { id: string }[];

    await post(owner.client, `/workspaces/${workspace.id}/finance/fees/${first!.id}/payments`)
      .send({ amount: '2000.00', method: 'CASH', paidAt: '2026-11-10' })
      .expect(201);
    await post(owner.client, `/workspaces/${workspace.id}/finance/fees/${second!.id}/payments`)
      .send({ amount: '3500.00', method: 'BANK', paidAt: '2026-11-10' })
      .expect(201);

    const overview = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/finance/overview?month=2026-11`,
    );

    expect(overview.status).toBe(200);
    expect(overview.body).toMatchObject({
      month: '2026-11',
      currency: 'LKR',
      billed: '7000.00',
      collected: '5500.00',
      outstanding: '1500.00',
      counts: { unpaid: 0, partial: 1, paid: 1, void: 0 },
    });
    expect(overview.body.overdue).toBe(1);
  });

  it('restricts finance to managers and scopes records to the workspace', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const admin = await addMember(owner.client, workspace.id, 'admin@example.com', 'ADMIN');
    const teacher = await addMember(owner.client, workspace.id, 'teacher@example.com');
    const studentMember = await addMember(
      owner.client,
      workspace.id,
      'student@example.com',
      'STUDENT',
    );
    const outsider = await registerVerifiedUser(context, 'outsider@example.com');

    const plan = await createPlan(owner.client, workspace.id);
    const amara = await createStudent(owner.client, workspace.id, 'Amara');
    const fee = await post(owner.client, `/workspaces/${workspace.id}/finance/fees`).send({
      studentId: amara.id,
      description: 'Admission fee',
      amount: '5000.00',
      dueDate: '2026-11-30',
    });

    const adminList = await admin.client.get(`/api/v1/workspaces/${workspace.id}/finance/plans`);

    expect(adminList.status).toBe(200);

    for (const client of [teacher.client, studentMember.client, outsider.client]) {
      expect(await client.get(`/api/v1/workspaces/${workspace.id}/finance/plans`)).toHaveProperty(
        'status',
        403,
      );
    }

    const other = await registerVerifiedUser(context, 'other@example.com');
    const otherWorkspace = await createWorkspace(other.client, 'Other', 'INSTITUTE');
    const otherStudent = await createStudent(other.client, otherWorkspace.id, 'Kumari');

    expect(
      (await other.client.get(`/api/v1/workspaces/${otherWorkspace.id}/finance/plans/${plan.id}`))
        .status,
    ).toBe(404);

    expect(
      (
        await other.client.get(
          `/api/v1/workspaces/${otherWorkspace.id}/finance/fees/${fee.body.id}`,
        )
      ).status,
    ).toBe(404);

    expect(
      (
        await post(other.client, `/workspaces/${otherWorkspace.id}/finance/fees`).send({
          studentId: amara.id,
          description: 'Cross-tenant fee',
          amount: '100.00',
          dueDate: '2026-11-30',
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await post(other.client, `/workspaces/${otherWorkspace.id}/finance/plans`).send({
          name: 'Cross-tenant plan',
          amount: '100.00',
          classId: '11111111-1111-4111-8111-111111111111',
        })
      ).status,
    ).toBe(404);

    const otherList = await other.client.get(
      `/api/v1/workspaces/${otherWorkspace.id}/finance/fees`,
    );

    expect(otherList.body.total).toBe(0);
    expect(otherStudent.id).toBeTruthy();
  });

  it('validates payload shapes and dates', async () => {
    const owner = await registerVerifiedUser(context, 'owner@example.com');
    const workspace = await createWorkspace(owner.client, 'Institute', 'INSTITUTE');
    const amara = await createStudent(owner.client, workspace.id, 'Amara');

    for (const body of [
      { name: 'Plan', amount: '0' },
      { name: 'Plan', amount: '-5' },
      { name: 'Plan', amount: '10.999' },
      { name: 'Plan', amount: '10', dueDay: 0 },
      { name: 'Plan', amount: '10', billingPeriod: 'YEARLY' },
      { name: '', amount: '10' },
    ]) {
      expect(
        (await post(owner.client, `/workspaces/${workspace.id}/finance/plans`).send(body)).status,
      ).toBe(400);
    }

    for (const body of [
      { studentId: amara.id, description: 'Fee', amount: '0', dueDate: '2026-11-30' },
      { studentId: amara.id, description: '', amount: '10', dueDate: '2026-11-30' },
      { studentId: amara.id, description: 'Fee', amount: '10', dueDate: '2026-02-31' },
      { studentId: 'not-a-uuid', description: 'Fee', amount: '10', dueDate: '2026-11-30' },
    ]) {
      expect(
        (await post(owner.client, `/workspaces/${workspace.id}/finance/fees`).send(body)).status,
      ).toBe(400);
    }

    for (const body of [{}, { period: '2026-13' }, { period: '202611' }]) {
      expect(
        (
          await post(
            owner.client,
            `/workspaces/${workspace.id}/finance/plans/11111111-1111-4111-8111-111111111111/generate`,
          ).send(body)
        ).status,
      ).toBe(400);
    }

    const badMonth = await owner.client.get(
      `/api/v1/workspaces/${workspace.id}/finance/overview?month=2026-00`,
    );

    expect(badMonth.status).toBe(400);
  });
});
