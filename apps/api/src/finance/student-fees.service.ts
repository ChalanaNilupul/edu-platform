import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AuditEventType, FeeStatus } from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import type { CreateStudentFeeDto } from './dto/create-student-fee.dto.js';
import type { ListStudentFeesQueryDto } from './dto/list-student-fees.query.js';
import type { UpdateStudentFeeDto } from './dto/update-student-fee.dto.js';
import {
  MANAGE_ROLES,
  money,
  parseAmount,
  parseCalendarDate,
  parseMonth,
  studentFeeDetailSelect,
  studentFeeSelect,
  toStudentFeeDetailView,
  toStudentFeeView,
} from './finance.shared.js';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function nullableText(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value.length === 0 ? null : value;
}

function statusFor(amount: Prisma.Decimal, paid: Prisma.Decimal): FeeStatus {
  return paid.gte(amount) ? FeeStatus.PAID : paid.gt(0) ? FeeStatus.PARTIAL : FeeStatus.UNPAID;
}

@Injectable()
export class StudentFeesService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(actorId: string, workspaceId: string, query: ListStudentFeesQueryDto) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

      const page = query.page ?? 1;
      const pageSize = Math.min(query.pageSize ?? PAGE_SIZE, MAX_PAGE_SIZE);
      const where: Prisma.StudentFeeWhereInput = { workspaceId };

      if (query.status) {
        where.status = query.status;
      }

      if (query.classId) {
        where.classId = query.classId;
      }

      if (query.planId) {
        where.feePlanId = query.planId;
      }

      if (query.month) {
        where.periodMonth = parseMonth(query.month);
      }

      if (query.search) {
        where.student = {
          is: {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { studentCode: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        };
      }

      const [total, rows] = await Promise.all([
        tx.studentFee.count({ where }),
        tx.studentFee.findMany({
          where,
          select: studentFeeSelect,
          orderBy: [{ periodMonth: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      return {
        items: rows.map(toStudentFeeView),
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    });
  }

  async findOne(actorId: string, workspaceId: string, feeId: string) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

      const row = await tx.studentFee.findFirst({
        where: { id: feeId, workspaceId },
        select: studentFeeDetailSelect,
      });

      if (!row) {
        throw new NotFoundException('Fee record not found');
      }

      return toStudentFeeDetailView(row);
    });
  }

  async create(actorId: string, workspaceId: string, dto: CreateStudentFeeDto) {
    const amount = parseAmount(dto.amount);
    const dueDate = parseCalendarDate(dto.dueDate, 'dueDate');

    const created = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      const membership = await this.workspaceAccess.requireRoles(
        actorId,
        workspaceId,
        MANAGE_ROLES,
        tx,
      );

      await this.requireStudent(tx, workspaceId, dto.studentId);

      if (dto.classId) {
        const schoolClass = await tx.class.findFirst({
          where: { id: dto.classId, workspaceId },
          select: { id: true },
        });

        if (!schoolClass) {
          throw new NotFoundException('Class not found');
        }
      }

      return tx.studentFee.create({
        data: {
          workspaceId,
          studentId: dto.studentId,
          classId: dto.classId ?? null,
          description: dto.description,
          amount,
          dueDate,
          note: nullableText(dto.note) ?? null,
          createdByMembershipId: membership.id,
        },
        select: studentFeeSelect,
      });
    });

    await this.audit.record({
      type: AuditEventType.STUDENT_FEE_CREATED,
      actorUserId: actorId,
      workspaceId,
      targetId: created.id,
      metadata: {
        studentId: created.studentId,
        classId: created.classId,
        amount: money(created.amount),
      },
    });

    return toStudentFeeView(created);
  }

  async update(actorId: string, workspaceId: string, feeId: string, dto: UpdateStudentFeeDto) {
    const amount = dto.amount === undefined ? undefined : parseAmount(dto.amount);
    const dueDate =
      dto.dueDate === undefined ? undefined : parseCalendarDate(dto.dueDate, 'dueDate');

    if (dto.status !== undefined && dto.status !== FeeStatus.VOID) {
      throw new BadRequestException('Only voiding is supported when changing fee status');
    }

    const outcome = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

      const existing = await tx.studentFee.findFirst({
        where: { id: feeId, workspaceId },
        select: {
          id: true,
          amount: true,
          paidAmount: true,
          status: true,
          description: true,
          dueDate: true,
          note: true,
        },
      });

      if (!existing) {
        throw new NotFoundException('Fee record not found');
      }

      if (existing.status === FeeStatus.VOID) {
        throw new ConflictException('Voided fee records cannot be changed');
      }

      const voiding = dto.status === FeeStatus.VOID;

      if (voiding && existing.paidAmount.gt(0)) {
        throw new ConflictException('Reverse the recorded payments before voiding this fee');
      }

      const changes: Prisma.StudentFeeUncheckedUpdateInput = {};
      const changed: string[] = [];

      if (dto.description !== undefined && dto.description !== existing.description) {
        changes.description = dto.description;
        changed.push('description');
      }

      if (dueDate !== undefined && dueDate.getTime() !== existing.dueDate.getTime()) {
        changes.dueDate = dueDate;
        changed.push('dueDate');
      }

      if (dto.note !== undefined) {
        const note = nullableText(dto.note) ?? null;

        if (note !== existing.note) {
          changes.note = note;
          changed.push('note');
        }
      }

      if (amount !== undefined && !amount.equals(existing.amount)) {
        if (amount.lt(existing.paidAmount)) {
          throw new BadRequestException('Amount cannot be less than the amount already paid');
        }

        changes.amount = amount;
        changes.status = statusFor(amount, existing.paidAmount);
        changed.push('amount');
      }

      if (voiding) {
        changes.status = FeeStatus.VOID;
        changed.push('status');
      }

      if (changed.length > 0) {
        await tx.studentFee.update({
          where: { id: existing.id },
          data: changes,
        });
      }

      const row = await tx.studentFee.findFirst({
        where: { id: existing.id, workspaceId },
        select: studentFeeDetailSelect,
      });

      if (!row) {
        throw new NotFoundException('Fee record not found');
      }

      return { fee: toStudentFeeDetailView(row), changed, voiding };
    });

    if (outcome.voiding) {
      await this.audit.record({
        type: AuditEventType.STUDENT_FEE_VOIDED,
        actorUserId: actorId,
        workspaceId,
        targetId: feeId,
      });
    } else if (outcome.changed.length > 0) {
      await this.audit.record({
        type: AuditEventType.STUDENT_FEE_UPDATED,
        actorUserId: actorId,
        workspaceId,
        targetId: feeId,
        metadata: { fields: outcome.changed },
      });
    }

    return outcome.fee;
  }

  private async requireStudent(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    studentId: string,
  ) {
    const student = await tx.student.findFirst({
      where: { id: studentId, workspaceId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }
  }
}
