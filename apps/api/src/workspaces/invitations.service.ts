import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { createOpaqueToken, hashToken } from '../auth/token.util.js';
import { InvitationStatus, MembershipStatus, WorkspaceRole } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkspaceAccessService } from './workspace-access.service.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(MailService) private readonly mail: MailService,
  ) {}

  async create(actorId: string, workspaceId: string, emailInput: string, role: WorkspaceRole) {
    const actor = await this.workspaceAccess.requireRoles(actorId, workspaceId, [
      WorkspaceRole.ADMIN,
    ]);

    if (role === WorkspaceRole.OWNER) {
      throw new BadRequestException('Workspace ownership cannot be transferred by invitation');
    }

    if (role === WorkspaceRole.ADMIN && actor.role !== WorkspaceRole.OWNER) {
      throw new ForbiddenException('Only the workspace owner can invite administrators');
    }

    const email = emailInput.trim().toLowerCase();

    const existingMembership = await this.prisma.membership.findFirst({
      where: {
        workspaceId,
        user: { email },
      },
      select: { id: true },
    });

    if (existingMembership) {
      throw new ConflictException('This user is already a member of the workspace');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const { token, tokenHash } = createOpaqueToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const invitation = await this.prisma.workspaceInvitation.upsert({
      where: {
        workspaceId_email: {
          workspaceId,
          email,
        },
      },
      create: {
        workspaceId,
        email,
        role,
        tokenHash,
        invitedById: actorId,
        expiresAt,
      },
      update: {
        role,
        tokenHash,
        status: InvitationStatus.PENDING,
        invitedById: actorId,
        expiresAt,
        acceptedAt: null,
        acceptedById: null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    try {
      await this.mail.sendWorkspaceInvitation(email, token);
    } catch (error) {
      this.logger.error(
        'Workspace invitation email could not be sent',
        error instanceof Error ? error.stack : undefined,
      );
    }

    return invitation;
  }

  async list(actorId: string, workspaceId: string) {
    await this.workspaceAccess.requireRoles(actorId, workspaceId, [WorkspaceRole.ADMIN]);

    return this.prisma.workspaceInvitation.findMany({
      where: {
        workspaceId,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(actorId: string, workspaceId: string, invitationId: string) {
    await this.workspaceAccess.requireRoles(actorId, workspaceId, [WorkspaceRole.ADMIN]);

    const invitation = await this.prisma.workspaceInvitation.findFirst({
      where: {
        id: invitationId,
        workspaceId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Only pending invitations can be revoked');
    }

    await this.prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.REVOKED },
    });

    return { message: 'Invitation revoked' };
  }

  async accept(userId: string, userEmail: string, sessionId: string | undefined, token: string) {
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new BadRequestException('Invitation is invalid or has expired');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is no longer valid');
    }

    if (invitation.expiresAt <= new Date()) {
      await this.prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });

      throw new BadRequestException('Invitation is invalid or has expired');
    }

    if (invitation.email !== userEmail.trim().toLowerCase()) {
      throw new ForbiddenException('This invitation was sent to a different email address');
    }

    const membership = await this.prisma.$transaction(async (tx) => {
      const acceptedMembership = await tx.membership.upsert({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: invitation.workspaceId,
          },
        },
        create: {
          userId,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
          status: MembershipStatus.ACTIVE,
        },
        update: {
          role: invitation.role,
          status: MembershipStatus.ACTIVE,
        },
        select: {
          id: true,
          role: true,
          status: true,
        },
      });

      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedById: userId,
        },
      });

      if (sessionId) {
        await tx.session.updateMany({
          where: {
            id: sessionId,
            userId,
            expiresAt: { gt: new Date() },
          },
          data: {
            activeWorkspaceId: invitation.workspaceId,
          },
        });
      }

      return acceptedMembership;
    });

    return {
      message: 'Invitation accepted',
      workspace: invitation.workspace,
      membership,
    };
  }
}
