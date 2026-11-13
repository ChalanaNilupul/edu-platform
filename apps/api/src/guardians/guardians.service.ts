import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { AuditEventType, WorkspaceRole } from '../generated/prisma/client.js';
import type { Prisma } from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import type { CreateGuardianDto } from './dto/create-guardian.dto.js';
import type { UpdateGuardianDto } from './dto/update-guardian.dto.js';

const READ_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER];
const MANAGE_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER];

const guardianSelect = {
  id: true,
  firstName: true,
  lastName: true,
  relationship: true,
  email: true,
  phone: true,
  occupation: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  district: true,
  postalCode: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.GuardianSelect;

type GuardianRow = Prisma.GuardianGetPayload<{ select: typeof guardianSelect }>;

function nullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value === null || value.length === 0 ? null : value;
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

// The form submits the whole profile, so only differences are written and audited.
function changedFields(
  existing: GuardianRow,
  data: Prisma.GuardianUncheckedUpdateInput,
): Prisma.GuardianUncheckedUpdateInput {
  const changed: Prisma.GuardianUncheckedUpdateInput = {};

  for (const [field, value] of Object.entries(data)) {
    if (comparable(existing[field as keyof GuardianRow]) !== comparable(value)) {
      (changed as Record<string, unknown>)[field] = value;
    }
  }

  return changed;
}

@Injectable()
export class GuardiansService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listForStudent(actorId: string, workspaceId: string, studentId: string) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);
      await this.requireStudent(tx, workspaceId, studentId);

      const links = await tx.studentGuardian.findMany({
        where: { workspaceId, studentId },
        select: {
          id: true,
          isPrimary: true,
          guardian: { select: guardianSelect },
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      });

      return { items: links };
    });
  }

  async findOne(actorId: string, workspaceId: string, guardianId: string) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);

      const guardian = await tx.guardian.findFirst({
        where: { id: guardianId, workspaceId },
        select: {
          ...guardianSelect,
          students: {
            select: {
              student: {
                select: { id: true, studentCode: true, firstName: true, lastName: true },
              },
            },
          },
        },
      });

      if (!guardian) {
        throw new NotFoundException('Guardian not found');
      }

      const { students, ...profile } = guardian;

      return { ...profile, linkedStudents: students.map((link) => link.student) };
    });
  }

  async createForStudent(
    actorId: string,
    workspaceId: string,
    studentId: string,
    dto: CreateGuardianDto,
  ) {
    const created = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);
      await this.requireStudent(tx, workspaceId, studentId);

      const linkCount = await tx.studentGuardian.count({ where: { workspaceId, studentId } });
      const isPrimary = dto.isPrimary ?? linkCount === 0;

      if (isPrimary && linkCount > 0) {
        await tx.studentGuardian.updateMany({
          where: { workspaceId, studentId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const guardian = await tx.guardian.create({
        data: {
          workspaceId,
          firstName: dto.firstName,
          lastName: nullableText(dto.lastName) ?? null,
          relationship: dto.relationship,
          email: nullableText(dto.email) ?? null,
          phone: nullableText(dto.phone) ?? null,
          occupation: nullableText(dto.occupation) ?? null,
          addressLine1: nullableText(dto.addressLine1) ?? null,
          addressLine2: nullableText(dto.addressLine2) ?? null,
          city: nullableText(dto.city) ?? null,
          district: nullableText(dto.district) ?? null,
          postalCode: nullableText(dto.postalCode) ?? null,
        },
        select: guardianSelect,
      });

      const link = await tx.studentGuardian.create({
        data: { workspaceId, studentId, guardianId: guardian.id, isPrimary },
        select: { id: true, isPrimary: true },
      });

      return { id: link.id, isPrimary: link.isPrimary, guardian };
    });

    await this.audit.record({
      type: AuditEventType.GUARDIAN_CREATED,
      actorUserId: actorId,
      workspaceId,
      targetId: created.guardian.id,
      metadata: { studentId, isPrimary: created.isPrimary },
    });

    return created;
  }

  async update(actorId: string, workspaceId: string, guardianId: string, dto: UpdateGuardianDto) {
    const data = this.buildUpdateData(dto);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const result = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

      const existing = await tx.guardian.findFirst({
        where: { id: guardianId, workspaceId },
        select: guardianSelect,
      });

      if (!existing) {
        throw new NotFoundException('Guardian not found');
      }

      const changed = changedFields(existing, data);

      if (Object.keys(changed).length === 0) {
        return { updated: existing, changed };
      }

      const updated = await tx.guardian.update({
        where: { id: existing.id },
        data: changed,
        select: guardianSelect,
      });

      return { updated, changed };
    });

    const fields = Object.keys(result.changed);

    if (fields.length > 0) {
      await this.audit.record({
        type: AuditEventType.GUARDIAN_UPDATED,
        actorUserId: actorId,
        workspaceId,
        targetId: guardianId,
        metadata: { fields },
      });
    }

    return result.updated;
  }

  async unlink(actorId: string, workspaceId: string, studentId: string, guardianId: string) {
    await this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

      const link = await tx.studentGuardian.findFirst({
        where: { workspaceId, studentId, guardianId },
        select: { id: true },
      });

      if (!link) {
        throw new NotFoundException('Guardian is not linked to this student');
      }

      await tx.studentGuardian.delete({ where: { id: link.id } });
    });

    await this.audit.record({
      type: AuditEventType.GUARDIAN_UNLINKED,
      actorUserId: actorId,
      workspaceId,
      targetId: guardianId,
      metadata: { studentId },
    });
  }

  async remove(actorId: string, workspaceId: string, guardianId: string) {
    await this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

      const guardian = await tx.guardian.findFirst({
        where: { id: guardianId, workspaceId },
        select: { id: true },
      });

      if (!guardian) {
        throw new NotFoundException('Guardian not found');
      }

      const links = await tx.studentGuardian.count({ where: { workspaceId, guardianId } });

      if (links > 0) {
        throw new ConflictException(
          'Unlink this guardian from every student before deleting the record',
        );
      }

      await tx.guardian.delete({ where: { id: guardian.id } });
    });

    await this.audit.record({
      type: AuditEventType.GUARDIAN_DELETED,
      actorUserId: actorId,
      workspaceId,
      targetId: guardianId,
    });
  }

  private async requireStudent(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    studentId: string,
  ): Promise<void> {
    const student = await tx.student.findFirst({
      where: { id: studentId, workspaceId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }
  }

  private buildUpdateData(dto: UpdateGuardianDto): Prisma.GuardianUncheckedUpdateInput {
    const data: Prisma.GuardianUncheckedUpdateInput = {};

    if (dto.firstName !== undefined) {
      data.firstName = dto.firstName;
    }

    if (dto.lastName !== undefined) {
      data.lastName = nullableText(dto.lastName) ?? null;
    }

    if (dto.relationship !== undefined) {
      data.relationship = dto.relationship;
    }

    if (dto.email !== undefined) {
      data.email = nullableText(dto.email) ?? null;
    }

    if (dto.phone !== undefined) {
      data.phone = nullableText(dto.phone) ?? null;
    }

    if (dto.occupation !== undefined) {
      data.occupation = nullableText(dto.occupation) ?? null;
    }

    if (dto.addressLine1 !== undefined) {
      data.addressLine1 = nullableText(dto.addressLine1) ?? null;
    }

    if (dto.addressLine2 !== undefined) {
      data.addressLine2 = nullableText(dto.addressLine2) ?? null;
    }

    if (dto.city !== undefined) {
      data.city = nullableText(dto.city) ?? null;
    }

    if (dto.district !== undefined) {
      data.district = nullableText(dto.district) ?? null;
    }

    if (dto.postalCode !== undefined) {
      data.postalCode = nullableText(dto.postalCode) ?? null;
    }

    return data;
  }
}
