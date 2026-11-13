import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { AuditEventType, WorkspaceRole, type Prisma } from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import type { ListTeachersQueryDto } from './dto/list-teachers.query.js';
import type { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto.js';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const READ_ROLES: WorkspaceRole[] = [
  WorkspaceRole.ADMIN,
  WorkspaceRole.BRANCH_MANAGER,
  WorkspaceRole.TEACHER,
];
const MANAGE_ROLES: WorkspaceRole[] = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER];

const profileSelect = {
  id: true,
  phone: true,
  qualifications: true,
  specializations: true,
  bio: true,
  joinedAt: true,
  notes: true,
  updatedAt: true,
} satisfies Prisma.TeacherProfileSelect;

const teacherSelect = {
  id: true,
  role: true,
  status: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  teacherProfile: {
    select: profileSelect,
  },
} satisfies Prisma.MembershipSelect;

type ProfileData = {
  phone?: string | null;
  qualifications?: string | null;
  specializations?: string[];
  bio?: string | null;
  joinedAt?: Date | null;
  notes?: string | null;
};

function nullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value === null ? '' : value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

function buildProfileData(dto: UpdateTeacherProfileDto): ProfileData {
  const data: ProfileData = {};

  if (dto.phone !== undefined) {
    data.phone = nullableText(dto.phone);
  }

  if (dto.qualifications !== undefined) {
    data.qualifications = nullableText(dto.qualifications);
  }

  if (dto.specializations !== undefined) {
    data.specializations = Array.from(
      new Set(dto.specializations.map((item) => item.trim()).filter(Boolean)),
    );
  }

  if (dto.bio !== undefined) {
    data.bio = nullableText(dto.bio);
  }

  if (dto.joinedAt !== undefined) {
    data.joinedAt = dto.joinedAt === null ? null : new Date(dto.joinedAt);
  }

  if (dto.notes !== undefined) {
    data.notes = nullableText(dto.notes);
  }

  if (Object.keys(data).length === 0) {
    throw new BadRequestException('Provide at least one profile field');
  }

  return data;
}

function directoryEligibility(): Prisma.MembershipWhereInput {
  return {
    OR: [{ role: WorkspaceRole.TEACHER }, { teacherProfile: { isNot: null } }],
  };
}

@Injectable()
export class TeachersService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(actorId: string, workspaceId: string, query: ListTeachersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? PAGE_SIZE, MAX_PAGE_SIZE);
    const search = query.search?.trim();

    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);

      const conditions: Prisma.MembershipWhereInput[] = [directoryEligibility()];

      if (query.status) {
        conditions.push({ status: query.status });
      }

      if (search) {
        conditions.push({
          OR: [
            { user: { firstName: { contains: search, mode: 'insensitive' } } },
            { user: { lastName: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
            {
              teacherProfile: {
                is: { phone: { contains: search, mode: 'insensitive' } },
              },
            },
            {
              teacherProfile: {
                is: { qualifications: { contains: search, mode: 'insensitive' } },
              },
            },
          ],
        });
      }

      const where: Prisma.MembershipWhereInput = {
        workspaceId,
        AND: conditions,
      };

      const [items, total] = await Promise.all([
        tx.membership.findMany({
          where,
          select: teacherSelect,
          orderBy: [{ role: 'asc' }, { user: { firstName: 'asc' } }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tx.membership.count({ where }),
      ]);

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      };
    });
  }

  async findOne(actorId: string, workspaceId: string, membershipId: string) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);

      const teacher = await tx.membership.findFirst({
        where: {
          id: membershipId,
          workspaceId,
          AND: [directoryEligibility()],
        },
        select: teacherSelect,
      });

      if (!teacher) {
        throw new NotFoundException('Teacher not found');
      }

      return teacher;
    });
  }

  async upsertProfile(
    actorId: string,
    workspaceId: string,
    membershipId: string,
    dto: UpdateTeacherProfileDto,
  ) {
    const data = buildProfileData(dto);

    const result = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      const actor = await this.workspaceAccess.getActiveMembership(actorId, workspaceId, tx);
      const isManager = actor.role === WorkspaceRole.OWNER || MANAGE_ROLES.includes(actor.role);

      if (!isManager && actor.id !== membershipId) {
        throw new ForbiddenException('You can only edit your own teacher profile');
      }

      const membership = await tx.membership.findFirst({
        where: { id: membershipId, workspaceId },
        select: {
          id: true,
          teacherProfile: { select: { id: true } },
        },
      });

      if (!membership) {
        throw new NotFoundException('Teacher not found');
      }

      const fields = Object.keys(data);

      if (membership.teacherProfile) {
        const profile = await tx.teacherProfile.update({
          where: { id: membership.teacherProfile.id },
          data,
          select: profileSelect,
        });

        return { profile, created: false, fields };
      }

      const profile = await tx.teacherProfile.create({
        data: { workspaceId, membershipId, ...data },
        select: profileSelect,
      });

      return { profile, created: true, fields };
    });

    await this.audit.record({
      type: result.created
        ? AuditEventType.TEACHER_PROFILE_CREATED
        : AuditEventType.TEACHER_PROFILE_UPDATED,
      actorUserId: actorId,
      workspaceId,
      targetId: membershipId,
      metadata: { fields: result.fields },
    });

    return result.profile;
  }
}
