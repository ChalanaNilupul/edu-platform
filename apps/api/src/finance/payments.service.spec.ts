import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import {
  AuditEventType,
  FeeStatus,
  PaymentMethod,
  Prisma,
  WorkspaceRole,
} from '../generated/prisma/client.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { PaymentsService } from './payments.service.js';

const WORKSPACE_ID = 'workspace-123';
const ACTOR_ID = 'actor-123';
const FEE_ID = 'fee-123';
const PAYMENT_ID = 'payment-123';
const STUDENT_ID = 'student-123';
const MEMBERSHIP_ID = 'membership-123';

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PAYMENT_ID,
    studentFeeId: FEE_ID,
    amount: new Prisma.Decimal('2000.00'),
    method: PaymentMethod.CASH,
    paidAt: new Date('2026-11-10T00:00:00.000Z'),
    reference: null,
    note: null,
    createdAt: new Date('2026-11-10T09:00:00.000Z'),
    recordedBy: null,
    ...overrides,
  };
}

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: FEE_ID,
    studentId: STUDENT_ID,
    feePlanId: null,
    classId: null,
    description: 'Admission fee',
    amount: new Prisma.Decimal('5000.00'),
    paidAmount: new Prisma.Decimal('2000.00'),
    status: FeeStatus.PARTIAL,
    periodMonth: null,
    dueDate: new Date('2026-11-30T00:00:00.000Z'),
    note: null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-10T09:00:00.000Z'),
    student: {
      id: STUDENT_ID,
      studentCode: 'S-001',
      firstName: 'Amara',
      lastName: 'Silva',
      status: 'ACTIVE',
    },
    class: null,
    feePlan: null,
    _count: { payments: 1 },
    payments: [paymentRow()],
    ...overrides,
  };
}

describe('PaymentsService', () => {
  const tx = {
    $queryRaw: vi.fn(),
    payment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    studentFee: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
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

  let service: PaymentsService;

  function lockRow(overrides: Record<string, unknown> = {}) {
    return {
      id: FEE_ID,
      amount: new Prisma.Decimal('5000.00'),
      paid_amount: new Prisma.Decimal('0'),
      status: FeeStatus.UNPAID,
      ...overrides,
    };
  }

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
    tx.$queryRaw.mockResolvedValue([lockRow()]);
    tx.payment.create.mockResolvedValue(paymentRow());
    tx.payment.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal('2000.00') } });
    tx.studentFee.findFirst.mockResolvedValue(detailRow());
    auditMock.record.mockResolvedValue(undefined);

    service = new PaymentsService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
      auditMock as unknown as AuditService,
    );
  });

  it('records a payment, refreshes the cached totals and audits it', async () => {
    const outcome = await service.record(ACTOR_ID, WORKSPACE_ID, FEE_ID, {
      amount: '2000',
      method: PaymentMethod.CASH,
      paidAt: '2026-11-10',
    });

    const args = tx.payment.create.mock.calls[0]?.[0] as {
      data: {
        amount: Prisma.Decimal;
        method: PaymentMethod;
        paidAt: Date;
        recordedByMembershipId: string;
      };
    };

    expect(args.data.amount.toString()).toBe('2000');
    expect(args.data.method).toBe(PaymentMethod.CASH);
    expect(args.data.paidAt).toEqual(new Date('2026-11-10T00:00:00.000Z'));
    expect(args.data.recordedByMembershipId).toBe(MEMBERSHIP_ID);
    expect(tx.studentFee.update).toHaveBeenCalledWith({
      where: { id: FEE_ID },
      data: {
        paidAmount: new Prisma.Decimal('2000.00'),
        status: FeeStatus.PARTIAL,
      },
    });
    expect(outcome.fee).toMatchObject({ paidAmount: '2000.00', balance: '3000.00' });
    expect(outcome.payment.amount).toBe('2000.00');
    expect(auditMock.record).toHaveBeenCalledWith({
      type: AuditEventType.PAYMENT_RECORDED,
      actorUserId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
      targetId: FEE_ID,
      metadata: { paymentId: PAYMENT_ID, amount: '2000.00', method: PaymentMethod.CASH },
    });
  });

  it('rejects overpayments and voided fees', async () => {
    await expect(
      service.record(ACTOR_ID, WORKSPACE_ID, FEE_ID, {
        amount: '6000',
        method: PaymentMethod.BANK,
        paidAt: '2026-11-10',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.payment.create).not.toHaveBeenCalled();

    tx.$queryRaw.mockResolvedValue([lockRow({ status: FeeStatus.VOID })]);

    await expect(
      service.record(ACTOR_ID, WORKSPACE_ID, FEE_ID, {
        amount: '1000',
        method: PaymentMethod.BANK,
        paidAt: '2026-11-10',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects future payment dates before touching the database', async () => {
    await expect(
      service.record(ACTOR_ID, WORKSPACE_ID, FEE_ID, {
        amount: '1000',
        method: PaymentMethod.CASH,
        paidAt: '2999-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tenantMock.runAsTenant).not.toHaveBeenCalled();
  });

  it('returns 404 when the fee row cannot be locked', async () => {
    tx.$queryRaw.mockResolvedValue([]);

    await expect(
      service.record(ACTOR_ID, WORKSPACE_ID, FEE_ID, {
        amount: '1000',
        method: PaymentMethod.CASH,
        paidAt: '2026-11-10',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('deletes a payment, recalculates the fee and audits it', async () => {
    tx.payment.findFirst.mockResolvedValue(paymentRow());
    tx.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
    tx.studentFee.findFirst.mockResolvedValue(
      detailRow({
        paidAmount: new Prisma.Decimal('0'),
        status: FeeStatus.UNPAID,
        _count: { payments: 0 },
        payments: [],
      }),
    );

    await service.remove(ACTOR_ID, WORKSPACE_ID, FEE_ID, PAYMENT_ID);

    expect(tx.payment.delete).toHaveBeenCalledWith({ where: { id: PAYMENT_ID } });
    expect(tx.studentFee.update).toHaveBeenCalledWith({
      where: { id: FEE_ID },
      data: { paidAmount: new Prisma.Decimal(0), status: FeeStatus.UNPAID },
    });
    expect(auditMock.record).toHaveBeenCalledWith({
      type: AuditEventType.PAYMENT_DELETED,
      actorUserId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
      targetId: FEE_ID,
      metadata: { paymentId: PAYMENT_ID, amount: '2000.00', method: PaymentMethod.CASH },
    });
  });

  it('returns 404 for payments that do not belong to the fee', async () => {
    tx.payment.findFirst.mockResolvedValue(null);

    await expect(service.remove(ACTOR_ID, WORKSPACE_ID, FEE_ID, PAYMENT_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(tx.payment.delete).not.toHaveBeenCalled();
  });
});
