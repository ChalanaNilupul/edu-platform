import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import { AuditEventType, FeeStatus, Prisma, WorkspaceRole } from '../generated/prisma/client.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { StudentFeesService } from './student-fees.service.js';

const WORKSPACE_ID = 'workspace-123';
const ACTOR_ID = 'actor-123';
const FEE_ID = 'fee-123';
const STUDENT_ID = 'student-123';
const MEMBERSHIP_ID = 'membership-123';

function feeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: FEE_ID,
    studentId: STUDENT_ID,
    feePlanId: null,
    classId: null,
    description: 'Admission fee',
    amount: new Prisma.Decimal('5000.00'),
    paidAmount: new Prisma.Decimal('0'),
    status: FeeStatus.UNPAID,
    periodMonth: null,
    dueDate: new Date('2026-11-30T00:00:00.000Z'),
    note: null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    student: {
      id: STUDENT_ID,
      studentCode: 'S-001',
      firstName: 'Amara',
      lastName: 'Silva',
      status: 'ACTIVE',
    },
    class: null,
    feePlan: null,
    _count: { payments: 0 },
    ...overrides,
  };
}

function detailRow(overrides: Record<string, unknown> = {}) {
  return { ...feeRow(overrides), payments: [] };
}

describe('StudentFeesService', () => {
  const tx = {
    studentFee: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    student: { findFirst: vi.fn() },
    class: { findFirst: vi.fn() },
    payment: { aggregate: vi.fn() },
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

  let service: StudentFeesService;

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
    tx.student.findFirst.mockResolvedValue({ id: STUDENT_ID });
    tx.class.findFirst.mockResolvedValue({ id: 'class-123' });
    auditMock.record.mockResolvedValue(undefined);

    service = new StudentFeesService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
      auditMock as unknown as AuditService,
    );
  });

  it('lists fee records with status, month and student filters', async () => {
    tx.studentFee.count.mockResolvedValue(1);
    tx.studentFee.findMany.mockResolvedValue([
      feeRow({ amount: new Prisma.Decimal('5000.00'), paidAmount: new Prisma.Decimal('2000.00') }),
    ]);

    const result = await service.list(ACTOR_ID, WORKSPACE_ID, {
      search: 'amara',
      status: FeeStatus.PARTIAL,
      month: '2026-11',
      page: 1,
      pageSize: 20,
    });

    expect(tx.studentFee.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: WORKSPACE_ID,
        status: FeeStatus.PARTIAL,
        periodMonth: new Date('2026-11-01T00:00:00.000Z'),
        student: {
          is: {
            OR: [
              { firstName: { contains: 'amara', mode: 'insensitive' } },
              { lastName: { contains: 'amara', mode: 'insensitive' } },
              { studentCode: { contains: 'amara', mode: 'insensitive' } },
            ],
          },
        },
      },
      select: expect.any(Object),
      orderBy: [{ periodMonth: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      skip: 0,
      take: 20,
    });
    expect(result.items[0]).toMatchObject({
      amount: '5000.00',
      paidAmount: '2000.00',
      balance: '3000.00',
      dueDate: '2026-11-30',
      paymentCount: 0,
    });
  });

  it('creates a manual fee for a workspace student', async () => {
    tx.studentFee.create.mockResolvedValue(feeRow());

    const result = await service.create(ACTOR_ID, WORKSPACE_ID, {
      studentId: STUDENT_ID,
      description: 'Admission fee',
      amount: '5000',
      dueDate: '2026-11-30',
    });

    const args = tx.studentFee.create.mock.calls[0]?.[0] as {
      data: { amount: Prisma.Decimal; dueDate: Date; createdByMembershipId: string };
    };

    expect(args.data.amount.toString()).toBe('5000');
    expect(args.data.dueDate).toEqual(new Date('2026-11-30T00:00:00.000Z'));
    expect(args.data.createdByMembershipId).toBe(MEMBERSHIP_ID);
    expect(result.balance).toBe('5000.00');
    expect(auditMock.record).toHaveBeenCalledWith({
      type: AuditEventType.STUDENT_FEE_CREATED,
      actorUserId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
      targetId: FEE_ID,
      metadata: { studentId: STUDENT_ID, classId: null, amount: '5000.00' },
    });
  });

  it('rejects manual fees for unknown students or classes', async () => {
    tx.student.findFirst.mockResolvedValue(null);

    await expect(
      service.create(ACTOR_ID, WORKSPACE_ID, {
        studentId: STUDENT_ID,
        description: 'Admission fee',
        amount: '5000',
        dueDate: '2026-11-30',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    tx.student.findFirst.mockResolvedValue({ id: STUDENT_ID });
    tx.class.findFirst.mockResolvedValue(null);

    await expect(
      service.create(ACTOR_ID, WORKSPACE_ID, {
        studentId: STUDENT_ID,
        classId: 'class-123',
        description: 'Admission fee',
        amount: '5000',
        dueDate: '2026-11-30',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.studentFee.create).not.toHaveBeenCalled();
  });

  it('recalculates status when the amount changes above the paid total', async () => {
    tx.studentFee.findFirst
      .mockResolvedValueOnce({
        id: FEE_ID,
        amount: new Prisma.Decimal('5000.00'),
        paidAmount: new Prisma.Decimal('2000.00'),
        status: FeeStatus.PARTIAL,
        description: 'Admission fee',
        dueDate: new Date('2026-11-30T00:00:00.000Z'),
        note: null,
      })
      .mockResolvedValueOnce(
        detailRow({
          amount: new Prisma.Decimal('4000.00'),
          paidAmount: new Prisma.Decimal('2000.00'),
          status: FeeStatus.PARTIAL,
        }),
      );

    const result = await service.update(ACTOR_ID, WORKSPACE_ID, FEE_ID, { amount: '4000' });

    const args = tx.studentFee.update.mock.calls[0]?.[0] as {
      data: { amount: Prisma.Decimal; status: FeeStatus };
    };

    expect(args.data.amount.toString()).toBe('4000');
    expect(args.data.status).toBe(FeeStatus.PARTIAL);
    expect(result.amount).toBe('4000.00');
    expect(auditMock.record).toHaveBeenCalledWith({
      type: AuditEventType.STUDENT_FEE_UPDATED,
      actorUserId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
      targetId: FEE_ID,
      metadata: { fields: ['amount'] },
    });
  });

  it('blocks amounts below the paid total and voiding with payments', async () => {
    tx.studentFee.findFirst.mockResolvedValue({
      id: FEE_ID,
      amount: new Prisma.Decimal('5000.00'),
      paidAmount: new Prisma.Decimal('2000.00'),
      status: FeeStatus.PARTIAL,
      description: 'Admission fee',
      dueDate: new Date('2026-11-30T00:00:00.000Z'),
      note: null,
    });

    await expect(
      service.update(ACTOR_ID, WORKSPACE_ID, FEE_ID, { amount: '1500' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.update(ACTOR_ID, WORKSPACE_ID, FEE_ID, { status: FeeStatus.VOID }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.studentFee.update).not.toHaveBeenCalled();
  });

  it('voids an unpaid fee and audits it', async () => {
    tx.studentFee.findFirst
      .mockResolvedValueOnce({
        id: FEE_ID,
        amount: new Prisma.Decimal('5000.00'),
        paidAmount: new Prisma.Decimal('0'),
        status: FeeStatus.UNPAID,
        description: 'Admission fee',
        dueDate: new Date('2026-11-30T00:00:00.000Z'),
        note: null,
      })
      .mockResolvedValueOnce(detailRow({ status: FeeStatus.VOID }));

    const result = await service.update(ACTOR_ID, WORKSPACE_ID, FEE_ID, {
      status: FeeStatus.VOID,
    });

    const args = tx.studentFee.update.mock.calls[0]?.[0] as { data: { status: FeeStatus } };

    expect(args.data.status).toBe(FeeStatus.VOID);
    expect(result.status).toBe(FeeStatus.VOID);
    expect(auditMock.record).toHaveBeenCalledWith({
      type: AuditEventType.STUDENT_FEE_VOIDED,
      actorUserId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
      targetId: FEE_ID,
    });
  });

  it('returns 404 for fee records outside the workspace', async () => {
    tx.studentFee.findFirst.mockResolvedValue(null);

    await expect(service.findOne(ACTOR_ID, WORKSPACE_ID, FEE_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
