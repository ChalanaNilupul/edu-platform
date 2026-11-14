import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  AuditEventType,
  BillingPeriod,
  ClassStatus,
  EnrollmentStatus,
  FeePlanStatus,
  Prisma as PrismaRuntime,
  StudentStatus,
} from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import type { CreateFeePlanDto } from './dto/create-fee-plan.dto.js';
import type { GenerateStudentFeesDto } from './dto/generate-student-fees.dto.js';
import type { ListFeePlansQueryDto } from './dto/list-fee-plans.query.js';
import type { UpdateFeePlanDto } from './dto/update-fee-plan.dto.js';
import {
  MANAGE_ROLES,
  feePlanSelect,
  formatMonth,
  money,
  monthLabel,
  parseAmount,
  parseMonth,
  toFeePlanView,
} from './finance.shared.js';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof PrismaRuntime.PrismaClientKnownRequestError && error.code === 'P2002';
}

function nullableText(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value.length === 0 ? null : value;
}

function comparable(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

@Injectable()
export class FeePlansService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(actorId: string, workspaceId: string, query: ListFeePlansQueryDto) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

      const page = query.page ?? 1;
      const pageSize = Math.min(query.pageSize ?? PAGE_SIZE, MAX_PAGE_SIZE);
      const where: Prisma.FeePlanWhereInput = { workspaceId };

      if (query.search) {
        where.name = { contains: query.search, mode: 'insensitive' };
      }

      if (query.status) {
        where.status = query.status;
      }

      if (query.classId) {
        where.classId = query.classId;
      }

      const [total, rows] = await Promise.all([
        tx.feePlan.count({ where }),
        tx.feePlan.findMany({
          where,
          select: feePlanSelect,
          orderBy: [{ createdAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      return {
        items: rows.map(toFeePlanView),
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    });
  }

  async findOne(actorId: string, workspaceId: string, planId: string) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

      const row = await tx.feePlan.findFirst({
        where: { id: planId, workspaceId },
        select: feePlanSelect,
      });

      if (!row) {
        throw new NotFoundException('Fee plan not found');
      }

      return toFeePlanView(row);
    });
  }

  async create(actorId: string, workspaceId: string, dto: CreateFeePlanDto) {
    const amount = parseAmount(dto.amount);

    let created: Prisma.FeePlanGetPayload<{ select: typeof feePlanSelect }>;

    try {
      created = await this.tenant.runAsTenant(workspaceId, async (tx) => {
        await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

        if (dto.classId) {
          await this.requireClass(tx, workspaceId, dto.classId);
        }

        return tx.feePlan.create({
          data: {
            workspaceId,
            classId: dto.classId ?? null,
            name: dto.name,
            description: nullableText(dto.description) ?? null,
            amount,
            billingPeriod: dto.billingPeriod ?? BillingPeriod.MONTHLY,
            dueDay: dto.dueDay ?? 1,
          },
          select: feePlanSelect,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A fee plan with this name already exists');
      }

      throw error;
    }

    await this.audit.record({
      type: AuditEventType.FEE_PLAN_CREATED,
      actorUserId: actorId,
      workspaceId,
      targetId: created.id,
      metadata: {
        classId: created.classId,
        billingPeriod: created.billingPeriod,
        amount: money(created.amount),
      },
    });

    return toFeePlanView(created);
  }

  async update(actorId: string, workspaceId: string, planId: string, dto: UpdateFeePlanDto) {
    const amount = dto.amount === undefined ? undefined : parseAmount(dto.amount);

    let outcome: {
      plan: Prisma.FeePlanGetPayload<{ select: typeof feePlanSelect }>;
      changed: string[];
    };

    try {
      outcome = await this.tenant.runAsTenant(workspaceId, async (tx) => {
        await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

        const existing = await tx.feePlan.findFirst({
          where: { id: planId, workspaceId },
          select: feePlanSelect,
        });

        if (!existing) {
          throw new NotFoundException('Fee plan not found');
        }

        if (dto.classId) {
          await this.requireClass(tx, workspaceId, dto.classId);
        }

        const changes: Prisma.FeePlanUncheckedUpdateInput = {};
        const changed: string[] = [];

        if (dto.name !== undefined && dto.name !== existing.name) {
          changes.name = dto.name;
          changed.push('name');
        }

        if (dto.description !== undefined) {
          const description = nullableText(dto.description) ?? null;

          if (comparable(description) !== comparable(existing.description)) {
            changes.description = description;
            changed.push('description');
          }
        }

        if (amount !== undefined && !amount.equals(existing.amount)) {
          changes.amount = amount;
          changed.push('amount');
        }

        if (dto.classId !== undefined && dto.classId !== existing.classId) {
          changes.classId = dto.classId;
          changed.push('classId');
        }

        if (dto.billingPeriod !== undefined && dto.billingPeriod !== existing.billingPeriod) {
          changes.billingPeriod = dto.billingPeriod;
          changed.push('billingPeriod');
        }

        if (dto.dueDay !== undefined && dto.dueDay !== existing.dueDay) {
          changes.dueDay = dto.dueDay;
          changed.push('dueDay');
        }

        if (dto.status !== undefined && dto.status !== existing.status) {
          changes.status = dto.status;
          changed.push('status');
        }

        if (changed.length === 0) {
          return { plan: existing, changed };
        }

        const plan = await tx.feePlan.update({
          where: { id: existing.id },
          data: changes,
          select: feePlanSelect,
        });

        return { plan, changed };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A fee plan with this name already exists');
      }

      throw error;
    }

    if (outcome.changed.length > 0) {
      const archived =
        outcome.changed.length === 1 &&
        outcome.changed[0] === 'status' &&
        outcome.plan.status === FeePlanStatus.ARCHIVED;

      await this.audit.record({
        type: archived ? AuditEventType.FEE_PLAN_ARCHIVED : AuditEventType.FEE_PLAN_UPDATED,
        actorUserId: actorId,
        workspaceId,
        targetId: outcome.plan.id,
        metadata: { fields: outcome.changed },
      });
    }

    return toFeePlanView(outcome.plan);
  }

  async generate(
    actorId: string,
    workspaceId: string,
    planId: string,
    dto: GenerateStudentFeesDto,
  ) {
    const month = parseMonth(dto.period);

    const outcome = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      const membership = await this.workspaceAccess.requireRoles(
        actorId,
        workspaceId,
        MANAGE_ROLES,
        tx,
      );

      const plan = await tx.feePlan.findFirst({
        where: { id: planId, workspaceId },
        select: feePlanSelect,
      });

      if (!plan) {
        throw new NotFoundException('Fee plan not found');
      }

      if (plan.billingPeriod !== BillingPeriod.MONTHLY) {
        throw new BadRequestException('Only monthly plans can generate fee records');
      }

      if (plan.status !== FeePlanStatus.ACTIVE) {
        throw new ConflictException('Archived plans cannot generate fee records');
      }

      if (plan.class?.status === ClassStatus.ARCHIVED) {
        throw new ConflictException('Archived classes cannot generate fee records');
      }

      const students = await tx.student.findMany({
        where: {
          workspaceId,
          status: StudentStatus.ACTIVE,
          enrollments: {
            some: plan.classId
              ? { classId: plan.classId, status: EnrollmentStatus.ACTIVE }
              : { status: EnrollmentStatus.ACTIVE },
          },
        },
        select: { id: true },
      });

      const dueDate = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), plan.dueDay));

      const created = await tx.studentFee.createMany({
        data: students.map((student) => ({
          workspaceId,
          studentId: student.id,
          feePlanId: plan.id,
          classId: plan.classId,
          description: `${plan.name} — ${monthLabel(month)}`,
          amount: plan.amount,
          periodMonth: month,
          dueDate,
          createdByMembershipId: membership.id,
        })),
        skipDuplicates: true,
      });

      return {
        planId: plan.id,
        period: formatMonth(month),
        periodLabel: monthLabel(month),
        totalStudents: students.length,
        created: created.count,
        skipped: students.length - created.count,
      };
    });

    await this.audit.record({
      type: AuditEventType.STUDENT_FEES_GENERATED,
      actorUserId: actorId,
      workspaceId,
      targetId: outcome.planId,
      metadata: {
        period: outcome.period,
        created: outcome.created,
        skipped: outcome.skipped,
      },
    });

    return outcome;
  }

  private async requireClass(tx: Prisma.TransactionClient, workspaceId: string, classId: string) {
    const schoolClass = await tx.class.findFirst({
      where: { id: classId, workspaceId },
      select: { id: true },
    });

    if (!schoolClass) {
      throw new NotFoundException('Class not found');
    }
  }
}
