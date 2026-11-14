import { Inject, Injectable } from '@nestjs/common';

import { FeeStatus, Prisma as PrismaRuntime } from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import type { FinanceReportQueryDto } from './dto/finance-report.query.js';
import {
  MANAGE_ROLES,
  currentMonthStart,
  formatCalendarDate,
  formatMonth,
  formatReceiptNumber,
  money,
  nextMonthStart,
  parseMonth,
  utcToday,
} from './finance.shared.js';

const ZERO = new PrismaRuntime.Decimal(0);

type ClassBucket = {
  id: string | null;
  name: string;
  studentCount: number;
  billed: PrismaRuntime.Decimal;
  collected: PrismaRuntime.Decimal;
  outstanding: PrismaRuntime.Decimal;
};

@Injectable()
export class FinanceReportService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  async get(actorId: string, workspaceId: string, query: FinanceReportQueryDto) {
    const month = query.month ? parseMonth(query.month) : currentMonthStart();
    const next = nextMonthStart(month);
    const today = utcToday();

    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

      const [workspace, billedByClass, outstandingByClass, payments, overdue] = await Promise.all([
        tx.workspace.findUnique({
          where: { id: workspaceId },
          select: { currency: true },
        }),
        tx.studentFee.groupBy({
          by: ['classId'],
          where: {
            workspaceId,
            status: { not: FeeStatus.VOID },
            OR: [
              { periodMonth: month },
              { periodMonth: null, createdAt: { gte: month, lt: next } },
            ],
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        tx.studentFee.groupBy({
          by: ['classId'],
          where: { workspaceId, status: { not: FeeStatus.VOID } },
          _sum: { amount: true, paidAmount: true },
        }),
        tx.payment.findMany({
          where: { workspaceId, paidAt: { gte: month, lt: next } },
          select: {
            id: true,
            receiptNumber: true,
            amount: true,
            method: true,
            paidAt: true,
            reference: true,
            studentFee: {
              select: {
                id: true,
                description: true,
                periodMonth: true,
                class: { select: { id: true, name: true } },
                student: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    studentCode: true,
                  },
                },
              },
            },
          },
          orderBy: [{ paidAt: 'desc' }, { receiptNumber: 'desc' }],
        }),
        tx.studentFee.count({
          where: {
            workspaceId,
            status: { in: [FeeStatus.UNPAID, FeeStatus.PARTIAL] },
            dueDate: { lt: today },
          },
        }),
      ]);

      const classIds = [
        ...new Set(
          [...billedByClass, ...outstandingByClass]
            .map((row) => row.classId)
            .filter((id): id is string => id !== null),
        ),
      ];

      const classRows = classIds.length
        ? await tx.class.findMany({
            where: { workspaceId, id: { in: classIds } },
            select: { id: true, name: true },
          })
        : [];

      const classNames = new Map(classRows.map((row) => [row.id, row.name]));
      const buckets = new Map<string | null, ClassBucket>();

      function bucketFor(id: string | null): ClassBucket {
        const existing = buckets.get(id);

        if (existing) {
          return existing;
        }

        const created: ClassBucket = {
          id,
          name: id ? (classNames.get(id) ?? 'Unknown class') : 'No class',
          studentCount: 0,
          billed: ZERO,
          collected: ZERO,
          outstanding: ZERO,
        };

        buckets.set(id, created);

        return created;
      }

      for (const row of billedByClass) {
        const bucket = bucketFor(row.classId);
        bucket.billed = bucket.billed.plus(row._sum.amount ?? ZERO);
        bucket.studentCount += row._count._all;
      }

      for (const row of outstandingByClass) {
        const bucket = bucketFor(row.classId);
        bucket.outstanding = bucket.outstanding
          .plus(row._sum.amount ?? ZERO)
          .minus(row._sum.paidAmount ?? ZERO);
      }

      let collectedTotal = ZERO;

      for (const payment of payments) {
        const bucket = bucketFor(payment.studentFee.class?.id ?? null);
        bucket.collected = bucket.collected.plus(payment.amount);
        collectedTotal = collectedTotal.plus(payment.amount);
      }

      const classes = [...buckets.values()]
        .sort((a, b) => {
          if (a.id === null) {
            return 1;
          }

          if (b.id === null) {
            return -1;
          }

          return a.name.localeCompare(b.name);
        })
        .map((bucket) => ({
          id: bucket.id,
          name: bucket.name,
          studentCount: bucket.studentCount,
          billed: money(bucket.billed),
          collected: money(bucket.collected),
          outstanding: money(bucket.outstanding),
        }));

      const billedTotal = billedByClass.reduce(
        (sum, row) => sum.plus(row._sum.amount ?? ZERO),
        ZERO,
      );
      const outstandingTotal = outstandingByClass.reduce(
        (sum, row) => sum.plus(row._sum.amount ?? ZERO).minus(row._sum.paidAmount ?? ZERO),
        ZERO,
      );

      return {
        month: formatMonth(month),
        currency: workspace?.currency ?? 'LKR',
        totals: {
          billed: money(billedTotal),
          collected: money(collectedTotal),
          outstanding: money(outstandingTotal),
          overdue,
        },
        classes,
        payments: payments.map((row) => {
          const student = row.studentFee.student;

          return {
            id: row.id,
            receiptNo: formatReceiptNumber(row.receiptNumber),
            amount: money(row.amount),
            method: row.method,
            paidAt: formatCalendarDate(row.paidAt),
            reference: row.reference,
            student: {
              id: student.id,
              name: [student.firstName, student.lastName].filter(Boolean).join(' '),
              studentCode: student.studentCode,
            },
            fee: {
              id: row.studentFee.id,
              description: row.studentFee.description,
              periodMonth: row.studentFee.periodMonth
                ? formatMonth(row.studentFee.periodMonth)
                : null,
            },
            class: row.studentFee.class,
          };
        }),
      };
    });
  }
}
