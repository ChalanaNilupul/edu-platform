import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AuditEventType, FeeStatus, Prisma as PrismaRuntime } from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import type { CreatePaymentDto } from './dto/create-payment.dto.js';
import {
  MANAGE_ROLES,
  money,
  parseAmount,
  parseCalendarDate,
  paymentSelect,
  recalculateFeeTotals,
  studentFeeDetailSelect,
  toPaymentView,
  toStudentFeeDetailView,
  utcToday,
} from './finance.shared.js';

// One day of slack lets workspaces ahead of UTC record their local "today".
const FUTURE_SLACK_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async record(actorId: string, workspaceId: string, feeId: string, dto: CreatePaymentDto) {
    const amount = parseAmount(dto.amount);
    const paidAt = parseCalendarDate(dto.paidAt, 'paidAt');

    if (paidAt.getTime() > utcToday().getTime() + FUTURE_SLACK_MS) {
      throw new BadRequestException('paidAt cannot be in the future');
    }

    const outcome = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      const membership = await this.workspaceAccess.requireRoles(
        actorId,
        workspaceId,
        MANAGE_ROLES,
        tx,
      );

      const fee = await this.lockFee(tx, workspaceId, feeId);

      if (fee.status === FeeStatus.VOID) {
        throw new ConflictException('Voided fee records cannot receive payments');
      }

      const remaining = fee.amount.minus(fee.paidAmount);

      if (amount.gt(remaining)) {
        throw new BadRequestException(
          `Payment exceeds the outstanding balance of ${money(remaining)}`,
        );
      }

      const payment = await tx.payment.create({
        data: {
          workspaceId,
          studentFeeId: feeId,
          amount,
          method: dto.method,
          paidAt,
          reference: dto.reference ?? null,
          note: dto.note ?? null,
          recordedByMembershipId: membership.id,
        },
        select: paymentSelect,
      });

      await recalculateFeeTotals(tx, workspaceId, feeId);

      const row = await tx.studentFee.findFirst({
        where: { id: feeId, workspaceId },
        select: studentFeeDetailSelect,
      });

      if (!row) {
        throw new NotFoundException('Fee record not found');
      }

      return { payment: toPaymentView(payment), fee: toStudentFeeDetailView(row) };
    });

    await this.audit.record({
      type: AuditEventType.PAYMENT_RECORDED,
      actorUserId: actorId,
      workspaceId,
      targetId: feeId,
      metadata: {
        paymentId: outcome.payment.id,
        amount: outcome.payment.amount,
        method: outcome.payment.method,
      },
    });

    return outcome;
  }

  async remove(actorId: string, workspaceId: string, feeId: string, paymentId: string) {
    const outcome = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);
      await this.lockFee(tx, workspaceId, feeId);

      const payment = await tx.payment.findFirst({
        where: { id: paymentId, studentFeeId: feeId, workspaceId },
        select: paymentSelect,
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      await tx.payment.delete({ where: { id: payment.id } });
      await recalculateFeeTotals(tx, workspaceId, feeId);

      const row = await tx.studentFee.findFirst({
        where: { id: feeId, workspaceId },
        select: studentFeeDetailSelect,
      });

      if (!row) {
        throw new NotFoundException('Fee record not found');
      }

      return { payment: toPaymentView(payment), fee: toStudentFeeDetailView(row) };
    });

    await this.audit.record({
      type: AuditEventType.PAYMENT_DELETED,
      actorUserId: actorId,
      workspaceId,
      targetId: feeId,
      metadata: {
        paymentId: outcome.payment.id,
        amount: outcome.payment.amount,
        method: outcome.payment.method,
      },
    });
  }

  private async lockFee(tx: Prisma.TransactionClient, workspaceId: string, feeId: string) {
    const rows = await tx.$queryRaw<
      {
        id: string;
        amount: PrismaRuntime.Decimal;
        paid_amount: PrismaRuntime.Decimal;
        status: FeeStatus;
      }[]
    >`
      SELECT "id", "amount", "paid_amount", "status"
      FROM "student_fees"
      WHERE "id" = ${feeId} AND "workspace_id" = ${workspaceId}
      FOR UPDATE
    `;

    const row = rows[0];

    if (!row) {
      throw new NotFoundException('Fee record not found');
    }

    return {
      id: row.id,
      amount: new PrismaRuntime.Decimal(row.amount),
      paidAmount: new PrismaRuntime.Decimal(row.paid_amount),
      status: row.status,
    };
  }
}
