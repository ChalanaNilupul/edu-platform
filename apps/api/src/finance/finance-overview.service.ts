import { Inject, Injectable } from '@nestjs/common';

import { FeeStatus, Prisma as PrismaRuntime } from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import type { FinanceOverviewQueryDto } from './dto/finance-overview.query.js';
import {
  MANAGE_ROLES,
  currentMonthStart,
  formatMonth,
  money,
  nextMonthStart,
  parseMonth,
  utcToday,
} from './finance.shared.js';

const ZERO = new PrismaRuntime.Decimal(0);

function sum(value: PrismaRuntime.Decimal | null | undefined): PrismaRuntime.Decimal {
  return value ?? ZERO;
}

@Injectable()
export class FinanceOverviewService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  async get(actorId: string, workspaceId: string, query: FinanceOverviewQueryDto) {
    const month = query.month ? parseMonth(query.month) : currentMonthStart();
    const next = nextMonthStart(month);
    const today = utcToday();

    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

      const [workspace, outstanding, collected, billed, counts, overdue] = await Promise.all([
        tx.workspace.findUnique({
          where: { id: workspaceId },
          select: { currency: true },
        }),
        tx.studentFee.aggregate({
          where: { workspaceId, status: { not: FeeStatus.VOID } },
          _sum: { amount: true, paidAmount: true },
        }),
        tx.payment.aggregate({
          where: { workspaceId, paidAt: { gte: month, lt: next } },
          _sum: { amount: true },
        }),
        tx.studentFee.aggregate({
          where: {
            workspaceId,
            status: { not: FeeStatus.VOID },
            OR: [
              { periodMonth: month },
              { periodMonth: null, createdAt: { gte: month, lt: next } },
            ],
          },
          _sum: { amount: true },
        }),
        tx.studentFee.groupBy({
          by: ['status'],
          where: { workspaceId },
          _count: { _all: true },
        }),
        tx.studentFee.count({
          where: {
            workspaceId,
            status: { in: [FeeStatus.UNPAID, FeeStatus.PARTIAL] },
            dueDate: { lt: today },
          },
        }),
      ]);

      const statusCounts = {
        unpaid: 0,
        partial: 0,
        paid: 0,
        void: 0,
      };

      for (const row of counts) {
        if (row.status === FeeStatus.UNPAID) {
          statusCounts.unpaid = row._count._all;
        } else if (row.status === FeeStatus.PARTIAL) {
          statusCounts.partial = row._count._all;
        } else if (row.status === FeeStatus.PAID) {
          statusCounts.paid = row._count._all;
        } else {
          statusCounts.void = row._count._all;
        }
      }

      return {
        month: formatMonth(month),
        currency: workspace?.currency ?? 'LKR',
        billed: money(sum(billed._sum.amount)),
        collected: money(sum(collected._sum.amount)),
        outstanding: money(sum(outstanding._sum.amount).minus(sum(outstanding._sum.paidAmount))),
        overdue,
        counts: statusCounts,
      };
    });
  }
}
