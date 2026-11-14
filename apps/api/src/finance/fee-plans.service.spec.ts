import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import {
  AuditEventType,
  BillingPeriod,
  ClassStatus,
  FeePlanStatus,
  Prisma,
  WorkspaceRole,
} from '../generated/prisma/client.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import type { CreateFeePlanDto } from './dto/create-fee-plan.dto.js';
import { FeePlansService } from './fee-plans.service.js';

const WORKSPACE_ID = 'workspace-123';
const ACTOR_ID = 'actor-123';
const PLAN_ID = 'plan-123';
const CLASS_ID = 'class-123';
const MEMBERSHIP_ID = 'membership-123';

function planRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    classId: null,
    name: 'Monthly tuition',
    description: null,
    amount: new Prisma.Decimal('3500.00'),
    billingPeriod: BillingPeriod.MONTHLY,
    dueDay: 5,
    status: FeePlanStatus.ACTIVE,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    class: null,
    ...overrides,
  };
}

describe('FeePlansService', () => {
  const tx = {
    feePlan: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    student: { findMany: vi.fn() },
    studentFee: { createMany: vi.fn() },
    class: { findFirst: vi.fn() },
  };

  const tenantMock = {
    runAsTenant: vi.fn(),
    runAsUser: vi.fn(),
    runAsSystem: vi.fn(),
  };

  const workspaceAccessMock = {
    getActiveMembership: vi.fn(),
    requireRoles: vi.fn(),
  };

  const auditMock = {
    record: vi.fn(),
  };

  let service: FeePlansService;

  beforeEach(() => {
    vi.resetAllMocks();

    tenantMock.runAsTenant.mockImplementation(
      async (_workspaceId: string, callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );
    workspaceAccessMock.requireRoles.mockResolvedValue({
      id: MEMBERSHIP_ID,
      role: WorkspaceRole.ADMIN,
    });
    tx.class.findFirst.mockResolvedValue({ id: CLASS_ID });
    auditMock.record.mockResolvedValue(undefined);

    service = new FeePlansService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
      auditMock as unknown as AuditService,
    );
  });

  function createDto(overrides: Partial<CreateFeePlanDto> = {}): CreateFeePlanDto {
    return { name: 'Monthly tuition', amount: '3500', dueDay: 5, ...overrides };
  }

  it('creates a plan with parsed amounts and default billing period', async () => {
    tx.feePlan.create.mockResolvedValue(planRow());

    const result = await service.create(ACTOR_ID, WORKSPACE_ID, createDto());

    expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
      ACTOR_ID,
      WORKSPACE_ID,
      expect.any(Array),
      tx,
    );

    const args = tx.feePlan.create.mock.calls[0]?.[0] as {
      data: { amount: Prisma.Decimal; billingPeriod: BillingPeriod; dueDay: number };
    };

    expect(args.data.amount.toString()).toBe('3500');
    expect(args.data.billingPeriod).toBe(BillingPeriod.MONTHLY);
    expect(args.data.dueDay).toBe(5);
    expect(result.amount).toBe('3500.00');
    expect(auditMock.record).toHaveBeenCalledWith({
      type: AuditEventType.FEE_PLAN_CREATED,
      actorUserId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
      targetId: PLAN_ID,
      metadata: { classId: null, billingPeriod: BillingPeriod.MONTHLY, amount: '3500.00' },
    });
  });

  it('rejects unknown classes and duplicate names', async () => {
    tx.class.findFirst.mockResolvedValue(null);

    await expect(
      service.create(ACTOR_ID, WORKSPACE_ID, createDto({ classId: CLASS_ID })),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.feePlan.create).not.toHaveBeenCalled();

    tx.class.findFirst.mockResolvedValue({ id: CLASS_ID });
    tx.feePlan.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.create(ACTOR_ID, WORKSPACE_ID, createDto())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('lists plans with filters and pagination', async () => {
    tx.feePlan.count.mockResolvedValue(1);
    tx.feePlan.findMany.mockResolvedValue([planRow()]);

    const result = await service.list(ACTOR_ID, WORKSPACE_ID, {
      search: 'tuition',
      status: FeePlanStatus.ACTIVE,
      classId: CLASS_ID,
      page: 2,
      pageSize: 10,
    });

    expect(tx.feePlan.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: WORKSPACE_ID,
        name: { contains: 'tuition', mode: 'insensitive' },
        status: FeePlanStatus.ACTIVE,
        classId: CLASS_ID,
      },
      select: expect.any(Object),
      orderBy: [{ createdAt: 'desc' }],
      skip: 10,
      take: 10,
    });
    expect(result).toMatchObject({ page: 2, pageSize: 10, total: 1, totalPages: 1 });
    expect(result.items[0]?.amount).toBe('3500.00');
  });

  it('audits only the fields that changed on update', async () => {
    tx.feePlan.findFirst.mockResolvedValue(planRow());
    tx.feePlan.update.mockResolvedValue(planRow({ name: 'Monthly tuition 2027', dueDay: 7 }));

    const result = await service.update(ACTOR_ID, WORKSPACE_ID, PLAN_ID, {
      name: 'Monthly tuition 2027',
      dueDay: 7,
    });

    const args = tx.feePlan.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };

    expect(args.data).toEqual({ name: 'Monthly tuition 2027', dueDay: 7 });
    expect(result.name).toBe('Monthly tuition 2027');
    expect(auditMock.record).toHaveBeenCalledWith({
      type: AuditEventType.FEE_PLAN_UPDATED,
      actorUserId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
      targetId: PLAN_ID,
      metadata: { fields: ['name', 'dueDay'] },
    });
  });

  it('records an archive event when a plan is archived', async () => {
    tx.feePlan.findFirst.mockResolvedValue(planRow());
    tx.feePlan.update.mockResolvedValue(planRow({ status: FeePlanStatus.ARCHIVED }));

    await service.update(ACTOR_ID, WORKSPACE_ID, PLAN_ID, { status: FeePlanStatus.ARCHIVED });

    expect(auditMock.record).toHaveBeenCalledWith({
      type: AuditEventType.FEE_PLAN_ARCHIVED,
      actorUserId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
      targetId: PLAN_ID,
      metadata: { fields: ['status'] },
    });
  });

  it('generates one fee per active enrollment of a class plan and skips duplicates', async () => {
    tx.feePlan.findFirst.mockResolvedValue(
      planRow({
        classId: CLASS_ID,
        class: { id: CLASS_ID, name: 'Grade 8', status: ClassStatus.ACTIVE },
      }),
    );
    tx.student.findMany.mockResolvedValue([{ id: 'student-1' }, { id: 'student-2' }]);
    tx.studentFee.createMany.mockResolvedValue({ count: 1 });

    const result = await service.generate(ACTOR_ID, WORKSPACE_ID, PLAN_ID, {
      period: '2026-11',
    });

    expect(tx.student.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: WORKSPACE_ID,
        status: 'ACTIVE',
        enrollments: { some: { classId: CLASS_ID, status: 'ACTIVE' } },
      },
      select: { id: true },
    });

    const args = tx.studentFee.createMany.mock.calls[0]?.[0] as {
      data: { description: string; dueDate: Date; periodMonth: Date; classId: string | null }[];
      skipDuplicates: boolean;
    };

    expect(args.skipDuplicates).toBe(true);
    expect(args.data).toHaveLength(2);
    expect(args.data[0]).toMatchObject({
      classId: CLASS_ID,
      description: 'Monthly tuition — November 2026',
      periodMonth: new Date('2026-11-01T00:00:00.000Z'),
      dueDate: new Date('2026-11-05T00:00:00.000Z'),
    });
    expect(result).toMatchObject({
      period: '2026-11',
      periodLabel: 'November 2026',
      totalStudents: 2,
      created: 1,
      skipped: 1,
    });
    expect(auditMock.record).toHaveBeenCalledWith({
      type: AuditEventType.STUDENT_FEES_GENERATED,
      actorUserId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
      targetId: PLAN_ID,
      metadata: { period: '2026-11', created: 1, skipped: 1 },
    });
  });

  it('rejects generation for one-time, archived or archived-class plans', async () => {
    tx.feePlan.findFirst.mockResolvedValue(planRow({ billingPeriod: BillingPeriod.ONE_TIME }));

    await expect(
      service.generate(ACTOR_ID, WORKSPACE_ID, PLAN_ID, { period: '2026-11' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    tx.feePlan.findFirst.mockResolvedValue(planRow({ status: FeePlanStatus.ARCHIVED }));

    await expect(
      service.generate(ACTOR_ID, WORKSPACE_ID, PLAN_ID, { period: '2026-11' }),
    ).rejects.toBeInstanceOf(ConflictException);

    tx.feePlan.findFirst.mockResolvedValue(
      planRow({ class: { id: CLASS_ID, name: 'Old class', status: ClassStatus.ARCHIVED } }),
    );

    await expect(
      service.generate(ACTOR_ID, WORKSPACE_ID, PLAN_ID, { period: '2026-11' }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.studentFee.createMany).not.toHaveBeenCalled();
    expect(auditMock.record).not.toHaveBeenCalled();
  });

  it('returns 404 for plans outside the workspace', async () => {
    tx.feePlan.findFirst.mockResolvedValue(null);

    await expect(service.findOne(ACTOR_ID, WORKSPACE_ID, PLAN_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
