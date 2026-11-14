import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeeStatus, Prisma, WorkspaceRole } from '../generated/prisma/client.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { FinanceOverviewService } from './finance-overview.service.js';

const WORKSPACE_ID = 'workspace-123';
const ACTOR_ID = 'actor-123';

describe('FinanceOverviewService', () => {
  const tx = {
    workspace: { findUnique: vi.fn() },
    studentFee: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
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

  let service: FinanceOverviewService;

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
    tx.studentFee.aggregate
      .mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal('8000.00'), paidAmount: new Prisma.Decimal('3000.00') },
      })
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('5000.00') } });
    tx.payment.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal('1500.00') } });
    tx.studentFee.groupBy.mockResolvedValue([
      { status: FeeStatus.UNPAID, _count: { _all: 2 } },
      { status: FeeStatus.PARTIAL, _count: { _all: 1 } },
      { status: FeeStatus.PAID, _count: { _all: 3 } },
      { status: FeeStatus.VOID, _count: { _all: 1 } },
    ]);
    tx.studentFee.count.mockResolvedValue(2);

    service = new FinanceOverviewService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
    );
  });

  it('summarises balances for the requested month', async () => {
    const result = await service.get(ACTOR_ID, WORKSPACE_ID, { month: '2026-11' });

    expect(tx.payment.aggregate).toHaveBeenCalledWith({
      where: {
        workspaceId: WORKSPACE_ID,
        paidAt: {
          gte: new Date('2026-11-01T00:00:00.000Z'),
          lt: new Date('2026-12-01T00:00:00.000Z'),
        },
      },
      _sum: { amount: true },
    });
    expect(result).toEqual({
      month: '2026-11',
      currency: 'LKR',
      billed: '5000.00',
      collected: '1500.00',
      outstanding: '5000.00',
      overdue: 2,
      counts: { unpaid: 2, partial: 1, paid: 3, void: 1 },
    });
  });

  it('falls back to LKR when the workspace row is missing', async () => {
    tx.workspace.findUnique.mockResolvedValue(null);

    const result = await service.get(ACTOR_ID, WORKSPACE_ID, { month: '2026-11' });

    expect(result.currency).toBe('LKR');
  });
});
