import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeeStatus, Prisma, WorkspaceRole } from '../generated/prisma/client.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { FinanceReportService } from './finance-report.service.js';

const WORKSPACE_ID = 'workspace-123';
const ACTOR_ID = 'actor-123';

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    receiptNumber: 1,
    amount: new Prisma.Decimal('2000.00'),
    method: 'CASH',
    paidAt: new Date('2026-11-10T00:00:00.000Z'),
    reference: null,
    studentFee: {
      id: 'fee-1',
      description: 'November tuition',
      periodMonth: new Date('2026-11-01T00:00:00.000Z'),
      class: { id: 'class-a', name: 'Grade 8' },
      student: { id: 'student-1', firstName: 'Amara', lastName: 'Silva', studentCode: 'S-001' },
    },
    ...overrides,
  };
}

describe('FinanceReportService', () => {
  const tx = {
    workspace: { findUnique: vi.fn() },
    studentFee: { groupBy: vi.fn(), count: vi.fn() },
    payment: { findMany: vi.fn() },
    class: { findMany: vi.fn() },
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

  let service: FinanceReportService;

  beforeEach(() => {
    vi.resetAllMocks();

    tenantMock.runAsTenant.mockImplementation(
      async (_workspaceId: string, callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );
    workspaceAccessMock.requireRoles.mockResolvedValue({
      id: 'membership-123',
      role: WorkspaceRole.ADMIN,
    });
    tx.workspace.findUnique.mockResolvedValue({ currency: 'LKR' });
    tx.studentFee.groupBy
      .mockResolvedValueOnce([
        {
          classId: 'class-a',
          _sum: { amount: new Prisma.Decimal('7000.00') },
          _count: { _all: 2 },
        },
        { classId: null, _sum: { amount: new Prisma.Decimal('1000.00') }, _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        {
          classId: 'class-a',
          _sum: {
            amount: new Prisma.Decimal('7000.00'),
            paidAmount: new Prisma.Decimal('5500.00'),
          },
        },
        {
          classId: 'class-b',
          _sum: { amount: new Prisma.Decimal('2500.00'), paidAmount: new Prisma.Decimal('0') },
        },
      ]);
    tx.payment.findMany.mockResolvedValue([
      paymentRow(),
      paymentRow({
        id: 'payment-2',
        receiptNumber: 2,
        amount: new Prisma.Decimal('3500.00'),
        method: 'BANK',
        reference: 'SLIP-1',
        studentFee: {
          id: 'fee-2',
          description: 'Annual levy',
          periodMonth: null,
          class: null,
          student: { id: 'student-2', firstName: 'Binod', lastName: null, studentCode: null },
        },
      }),
    ]);
    tx.class.findMany.mockResolvedValue([
      { id: 'class-a', name: 'Grade 8' },
      { id: 'class-b', name: 'Grade 9' },
    ]);
    tx.studentFee.count.mockResolvedValue(1);

    service = new FinanceReportService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
    );
  });

  it('breaks billed, collected and outstanding down per class', async () => {
    const result = await service.get(ACTOR_ID, WORKSPACE_ID, { month: '2026-11' });

    expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
      ACTOR_ID,
      WORKSPACE_ID,
      [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER],
      tx,
    );
    expect(tx.studentFee.groupBy).toHaveBeenCalledWith({
      by: ['classId'],
      where: {
        workspaceId: WORKSPACE_ID,
        status: { not: FeeStatus.VOID },
        OR: [
          { periodMonth: new Date('2026-11-01T00:00:00.000Z') },
          {
            periodMonth: null,
            createdAt: {
              gte: new Date('2026-11-01T00:00:00.000Z'),
              lt: new Date('2026-12-01T00:00:00.000Z'),
            },
          },
        ],
      },
      _sum: { amount: true },
      _count: { _all: true },
    });
    expect(tx.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: WORKSPACE_ID,
          paidAt: {
            gte: new Date('2026-11-01T00:00:00.000Z'),
            lt: new Date('2026-12-01T00:00:00.000Z'),
          },
        },
        orderBy: [{ paidAt: 'desc' }, { receiptNumber: 'desc' }],
      }),
    );
    expect(result.month).toBe('2026-11');
    expect(result.currency).toBe('LKR');
    expect(result.totals).toEqual({
      billed: '8000.00',
      collected: '5500.00',
      outstanding: '4000.00',
      overdue: 1,
    });
    expect(result.classes).toEqual([
      {
        id: 'class-a',
        name: 'Grade 8',
        studentCount: 2,
        billed: '7000.00',
        collected: '2000.00',
        outstanding: '1500.00',
      },
      {
        id: 'class-b',
        name: 'Grade 9',
        studentCount: 0,
        billed: '0.00',
        collected: '0.00',
        outstanding: '2500.00',
      },
      {
        id: null,
        name: 'No class',
        studentCount: 1,
        billed: '1000.00',
        collected: '3500.00',
        outstanding: '0.00',
      },
    ]);
    expect(result.payments).toEqual([
      expect.objectContaining({
        id: 'payment-1',
        receiptNo: 'RCPT-000001',
        amount: '2000.00',
        paidAt: '2026-11-10',
        student: { id: 'student-1', name: 'Amara Silva', studentCode: 'S-001' },
        fee: { id: 'fee-1', description: 'November tuition', periodMonth: '2026-11' },
        class: { id: 'class-a', name: 'Grade 8' },
      }),
      expect.objectContaining({
        id: 'payment-2',
        receiptNo: 'RCPT-000002',
        student: { id: 'student-2', name: 'Binod', studentCode: null },
        fee: { id: 'fee-2', description: 'Annual levy', periodMonth: null },
        class: null,
      }),
    ]);
  });

  it('falls back to LKR when the workspace row is missing', async () => {
    tx.workspace.findUnique.mockResolvedValue(null);

    const result = await service.get(ACTOR_ID, WORKSPACE_ID, { month: '2026-11' });

    expect(result.currency).toBe('LKR');
  });

  it('rejects an impossible month before opening a tenant transaction', async () => {
    await expect(service.get(ACTOR_ID, WORKSPACE_ID, { month: '2026-13' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(tenantMock.runAsTenant).not.toHaveBeenCalled();
  });
});
