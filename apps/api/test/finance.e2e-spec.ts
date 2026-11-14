import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/auth/auth.service.js';
import { SessionAuthGuard } from '../src/auth/session-auth.guard.js';
import { FeePlansController } from '../src/finance/fee-plans.controller.js';
import { FeePlansService } from '../src/finance/fee-plans.service.js';
import { FinanceOverviewController } from '../src/finance/finance-overview.controller.js';
import { FinanceOverviewService } from '../src/finance/finance-overview.service.js';
import { PaymentsService } from '../src/finance/payments.service.js';
import { StudentFeesController } from '../src/finance/student-fees.controller.js';
import { StudentFeesService } from '../src/finance/student-fees.service.js';
import { MembershipStatus, WorkspaceRole } from '../src/generated/prisma/client.js';
import { WorkspaceAccessService } from '../src/workspaces/workspace-access.service.js';
import { WorkspaceRolesGuard } from '../src/workspaces/workspace-roles.guard.js';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const PLAN_ID = '22222222-2222-4222-8222-222222222222';
const FEE_ID = '33333333-3333-4333-8333-333333333333';
const PAYMENT_ID = '44444444-4444-4444-8444-444444444444';
const STUDENT_ID = '55555555-5555-4555-8555-555555555555';
const CLASS_ID = '66666666-6666-4666-8666-666666666666';

const PLAN = {
  id: PLAN_ID,
  classId: null,
  name: 'Monthly tuition',
  description: null,
  amount: '3500.00',
  billingPeriod: 'MONTHLY',
  dueDay: 5,
  status: 'ACTIVE',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  class: null,
};

const PLAN_LIST = { items: [PLAN], page: 1, pageSize: 20, total: 1, totalPages: 1 };

const FEE = {
  id: FEE_ID,
  studentId: STUDENT_ID,
  feePlanId: null,
  classId: null,
  description: 'Admission fee',
  amount: '5000.00',
  paidAmount: '0.00',
  balance: '5000.00',
  status: 'UNPAID',
  periodMonth: null,
  dueDate: '2026-11-30',
  note: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  student: {
    id: STUDENT_ID,
    studentCode: 'S-001',
    firstName: 'Amara',
    lastName: 'Silva',
    status: 'ACTIVE',
  },
  class: null,
  feePlan: null,
  paymentCount: 0,
  payments: [],
};

const PAYMENT = {
  id: PAYMENT_ID,
  studentFeeId: FEE_ID,
  amount: '2000.00',
  method: 'CASH',
  paidAt: '2026-11-10',
  reference: null,
  note: null,
  createdAt: '2026-11-10T09:00:00.000Z',
  recordedBy: null,
};

const OVERVIEW = {
  month: '2026-11',
  currency: 'LKR',
  billed: '0.00',
  collected: '0.00',
  outstanding: '0.00',
  overdue: 0,
  counts: { unpaid: 0, partial: 0, paid: 0, void: 0 },
};

const GENERATED = {
  planId: PLAN_ID,
  period: '2026-11',
  periodLabel: 'November 2026',
  totalStudents: 2,
  created: 2,
  skipped: 0,
};

describe('Finance API (e2e)', () => {
  let app: INestApplication;

  const user = {
    id: 'user-123',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    emailVerifiedAt: new Date(),
  };

  const authService = {
    getCurrentSession: vi.fn(async (token?: string) => {
      if (token !== 'valid-session') {
        throw new UnauthorizedException();
      }

      return {
        user,
        sessionId: 'session-123',
        activeWorkspaceId: null,
      };
    }),
  };

  const feePlansService = {
    list: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    generate: vi.fn(),
  };

  const studentFeesService = {
    list: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };

  const paymentsService = {
    record: vi.fn(),
    remove: vi.fn(),
  };

  const overviewService = {
    get: vi.fn(),
  };

  const workspaceAccessService = {
    getActiveMembership: vi.fn(),
    requireRoles: vi.fn(),
  };

  const membership = {
    id: 'membership-actor',
    role: WorkspaceRole.ADMIN,
    status: MembershipStatus.ACTIVE,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    workspaceAccessService.getActiveMembership.mockResolvedValue(membership);
    feePlansService.list.mockResolvedValue(PLAN_LIST);
    feePlansService.findOne.mockResolvedValue(PLAN);
    feePlansService.create.mockResolvedValue(PLAN);
    feePlansService.update.mockResolvedValue(PLAN);
    feePlansService.generate.mockResolvedValue(GENERATED);
    studentFeesService.list.mockResolvedValue({
      items: [FEE],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    studentFeesService.findOne.mockResolvedValue(FEE);
    studentFeesService.create.mockResolvedValue(FEE);
    studentFeesService.update.mockResolvedValue(FEE);
    paymentsService.record.mockResolvedValue({ payment: PAYMENT, fee: FEE });
    paymentsService.remove.mockResolvedValue(undefined);
    overviewService.get.mockResolvedValue(OVERVIEW);
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FeePlansController, StudentFeesController, FinanceOverviewController],
      providers: [
        SessionAuthGuard,
        WorkspaceRolesGuard,
        { provide: AuthService, useValue: authService },
        { provide: FeePlansService, useValue: feePlansService },
        { provide: StudentFeesService, useValue: studentFeesService },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: FinanceOverviewService, useValue: overviewService },
        { provide: WorkspaceAccessService, useValue: workspaceAccessService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function agent() {
    return request.agent(app.getHttpServer());
  }

  const base = `/api/v1/workspaces/${WORKSPACE_ID}/finance`;
  const cookie = 'edu_session=valid-session';

  it('rejects unauthenticated requests', async () => {
    for (const path of [`${base}/plans`, `${base}/fees`, `${base}/overview?month=2026-11`]) {
      const response = await agent().get(path);

      expect(response.status).toBe(401);
    }
  });

  it('lists plans and forwards query parameters', async () => {
    const response = await agent()
      .get(`${base}/plans?search=tuition&status=ACTIVE&classId=${CLASS_ID}&page=2&pageSize=10`)
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(PLAN_LIST);
    expect(feePlansService.list).toHaveBeenCalledWith(user.id, WORKSPACE_ID, {
      search: 'tuition',
      status: 'ACTIVE',
      classId: CLASS_ID,
      page: 2,
      pageSize: 10,
    });
  });

  it('creates plans with numeric amounts coerced to decimal strings', async () => {
    const response = await agent()
      .post(`${base}/plans`)
      .set('Cookie', cookie)
      .send({ name: 'Monthly tuition', amount: 3500, dueDay: 5 });

    expect(response.status).toBe(201);
    expect(feePlansService.create).toHaveBeenCalledWith(user.id, WORKSPACE_ID, {
      name: 'Monthly tuition',
      amount: '3500',
      dueDay: 5,
    });
  });

  it('rejects invalid plan payloads', async () => {
    const basePlan = { name: 'Monthly tuition', amount: '3500' };

    for (const body of [
      {},
      { ...basePlan, name: '' },
      { ...basePlan, amount: '-10' },
      { ...basePlan, amount: '10.999' },
      { ...basePlan, amount: 'abc' },
      { ...basePlan, dueDay: 0 },
      { ...basePlan, dueDay: 29 },
      { ...basePlan, classId: 'not-a-uuid' },
      { ...basePlan, billingPeriod: 'WEEKLY' },
      { ...basePlan, extra: true },
    ]) {
      const response = await agent().post(`${base}/plans`).set('Cookie', cookie).send(body);

      expect(response.status).toBe(400);
    }

    expect(feePlansService.create).not.toHaveBeenCalled();
  });

  it('rejects malformed ids and plan queries', async () => {
    for (const path of [
      `${base}/plans/not-a-uuid`,
      `${base}/plans?classId=not-a-uuid`,
      `${base}/plans?status=PAUSED`,
      `${base}/plans?page=0`,
      `${base}/plans?pageSize=101`,
      `${base}/plans?unknown=1`,
    ]) {
      const response = await agent().get(path).set('Cookie', cookie);

      expect(response.status).toBe(400);
    }
  });

  it('generates fees for a month and surfaces conflicts', async () => {
    const response = await agent()
      .post(`${base}/plans/${PLAN_ID}/generate`)
      .set('Cookie', cookie)
      .send({ period: '2026-11' });

    expect(response.status).toBe(201);
    expect(feePlansService.generate).toHaveBeenCalledWith(user.id, WORKSPACE_ID, PLAN_ID, {
      period: '2026-11',
    });

    for (const body of [
      {},
      { period: '2026-13' },
      { period: '202611' },
      { period: '2026-11', x: 1 },
    ]) {
      const invalid = await agent()
        .post(`${base}/plans/${PLAN_ID}/generate`)
        .set('Cookie', cookie)
        .send(body);

      expect(invalid.status).toBe(400);
    }

    feePlansService.generate.mockRejectedValueOnce(
      new ConflictException('Archived plans cannot generate fee records'),
    );

    const conflict = await agent()
      .post(`${base}/plans/${PLAN_ID}/generate`)
      .set('Cookie', cookie)
      .send({ period: '2026-11' });

    expect(conflict.status).toBe(409);
  });

  it('lists and creates fee records', async () => {
    const list = await agent()
      .get(`${base}/fees?status=PARTIAL&month=2026-11&search=silva`)
      .set('Cookie', cookie);

    expect(list.status).toBe(200);
    expect(studentFeesService.list).toHaveBeenCalledWith(user.id, WORKSPACE_ID, {
      status: 'PARTIAL',
      month: '2026-11',
      search: 'silva',
    });

    const create = await agent().post(`${base}/fees`).set('Cookie', cookie).send({
      studentId: STUDENT_ID,
      description: 'Admission fee',
      amount: '5000.00',
      dueDate: '2026-11-30',
    });

    expect(create.status).toBe(201);
    expect(studentFeesService.create).toHaveBeenCalledWith(user.id, WORKSPACE_ID, {
      studentId: STUDENT_ID,
      description: 'Admission fee',
      amount: '5000.00',
      dueDate: '2026-11-30',
    });
  });

  it('rejects invalid fee filters and payloads', async () => {
    for (const path of [
      `${base}/fees?status=OVERDUE`,
      `${base}/fees?month=2026-00`,
      `${base}/fees?planId=nope`,
      `${base}/fees?page=-1`,
    ]) {
      const response = await agent().get(path).set('Cookie', cookie);

      expect(response.status).toBe(400);
    }

    for (const body of [
      {},
      { studentId: STUDENT_ID, description: '', amount: '10', dueDate: '2026-11-30' },
      { studentId: STUDENT_ID, description: 'Fee', amount: '10', dueDate: '2026-02-31' },
      { studentId: 'nope', description: 'Fee', amount: '10', dueDate: '2026-11-30' },
    ]) {
      const response = await agent().post(`${base}/fees`).set('Cookie', cookie).send(body);

      expect(response.status).toBe(400);
    }

    expect(studentFeesService.create).not.toHaveBeenCalled();
  });

  it('updates and voids fee records', async () => {
    const update = await agent()
      .patch(`${base}/fees/${FEE_ID}`)
      .set('Cookie', cookie)
      .send({ status: 'VOID' });

    expect(update.status).toBe(200);
    expect(studentFeesService.update).toHaveBeenCalledWith(user.id, WORKSPACE_ID, FEE_ID, {
      status: 'VOID',
    });

    studentFeesService.update.mockRejectedValueOnce(
      new BadRequestException('Only voiding is supported when changing fee status'),
    );

    const blocked = await agent()
      .patch(`${base}/fees/${FEE_ID}`)
      .set('Cookie', cookie)
      .send({ status: 'PAID' });

    expect(blocked.status).toBe(400);

    studentFeesService.update.mockRejectedValueOnce(
      new ConflictException('Reverse the recorded payments before voiding this fee'),
    );

    const conflict = await agent()
      .patch(`${base}/fees/${FEE_ID}`)
      .set('Cookie', cookie)
      .send({ status: 'VOID' });

    expect(conflict.status).toBe(409);
  });

  it('records payments and validates payment payloads', async () => {
    const response = await agent()
      .post(`${base}/fees/${FEE_ID}/payments`)
      .set('Cookie', cookie)
      .send({ amount: '2000.00', method: 'CASH', paidAt: '2026-11-10', note: ' Front desk ' });

    expect(response.status).toBe(201);
    expect(paymentsService.record).toHaveBeenCalledWith(user.id, WORKSPACE_ID, FEE_ID, {
      amount: '2000.00',
      method: 'CASH',
      paidAt: '2026-11-10',
      note: 'Front desk',
    });

    for (const body of [
      {},
      { amount: '100', method: 'CARD', paidAt: '2026-11-10' },
      { amount: '100', method: 'CASH', paidAt: '2026-02-31' },
      { amount: '100', method: 'CASH', paidAt: '10-11-2026' },
      { amount: '100', method: 'CASH', paidAt: '2026-11-10', unknown: true },
    ]) {
      const invalid = await agent()
        .post(`${base}/fees/${FEE_ID}/payments`)
        .set('Cookie', cookie)
        .send(body);

      expect(invalid.status).toBe(400);
    }

    paymentsService.record.mockRejectedValueOnce(
      new BadRequestException('Payment exceeds the outstanding balance of 1000.00'),
    );

    const overpaid = await agent()
      .post(`${base}/fees/${FEE_ID}/payments`)
      .set('Cookie', cookie)
      .send({ amount: '2000', method: 'CASH', paidAt: '2026-11-10' });

    expect(overpaid.status).toBe(400);
  });

  it('deletes payments with no response body', async () => {
    const response = await agent()
      .delete(`${base}/fees/${FEE_ID}/payments/${PAYMENT_ID}`)
      .set('Cookie', cookie);

    expect(response.status).toBe(204);
    expect(paymentsService.remove).toHaveBeenCalledWith(user.id, WORKSPACE_ID, FEE_ID, PAYMENT_ID);
  });

  it('returns the finance overview and validates its month', async () => {
    const response = await agent().get(`${base}/overview?month=2026-11`).set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(OVERVIEW);
    expect(overviewService.get).toHaveBeenCalledWith(user.id, WORKSPACE_ID, { month: '2026-11' });

    const invalid = await agent().get(`${base}/overview?month=2026-13`).set('Cookie', cookie);

    expect(invalid.status).toBe(400);
  });

  it('lets branch managers reach finance but blocks teachers and students', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValueOnce({
      ...membership,
      role: WorkspaceRole.BRANCH_MANAGER,
    });

    const branchManager = await agent().get(`${base}/plans`).set('Cookie', cookie);

    expect(branchManager.status).toBe(200);

    for (const role of [WorkspaceRole.TEACHER, WorkspaceRole.STUDENT]) {
      workspaceAccessService.getActiveMembership.mockResolvedValueOnce({
        ...membership,
        role,
      });

      const response = await agent().get(`${base}/fees`).set('Cookie', cookie);

      expect(response.status).toBe(403);
    }

    expect(feePlansService.list).toHaveBeenCalledTimes(1);
    expect(studentFeesService.list).not.toHaveBeenCalled();
  });
});
