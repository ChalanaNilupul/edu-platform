import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  InvitationStatus,
  MembershipStatus,
  WorkspaceRole,
  WorkspaceType,
} from '../generated/prisma/client.js';
import type { MailService } from '../mail/mail.service.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import { InvitationsService } from './invitations.service.js';
import type { WorkspaceAccessService } from './workspace-access.service.js';

describe('InvitationsService', () => {
  const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

  const tx = {
    membership: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
    workspaceInvitation: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    session: {
      updateMany: vi.fn(),
    },
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

  const mailMock = {
    sendEmailVerification: vi.fn(),
    sendPasswordReset: vi.fn(),
    sendWorkspaceInvitation: vi.fn(),
  };

  let service: InvitationsService;

  beforeEach(() => {
    vi.resetAllMocks();

    tenantMock.runAsTenant.mockImplementation(
      async (_workspaceId: string, callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );
    tenantMock.runAsSystem.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    );

    service = new InvitationsService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
      mailMock as unknown as MailService,
    );
  });

  describe('create', () => {
    beforeEach(() => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'actor-membership',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
      tx.membership.findFirst.mockResolvedValue(null);
      tx.workspace.findUnique.mockResolvedValue({ name: 'My Tuition Class' });
    });

    it('normalizes the email, stores only the token hash and sends the invitation', async () => {
      tx.workspaceInvitation.upsert.mockResolvedValue({
        id: 'invitation-123',
        email: 'new@example.com',
        role: WorkspaceRole.TEACHER,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      const result = await service.create(
        'actor-123',
        'workspace-123',
        ' NEW@EXAMPLE.COM ',
        WorkspaceRole.TEACHER,
      );

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        'actor-123',
        'workspace-123',
        [WorkspaceRole.ADMIN],
        tx,
      );

      const upsertArgs = tx.workspaceInvitation.upsert.mock.calls[0]![0];
      const sentToken = mailMock.sendWorkspaceInvitation.mock.calls[0]![1] as string;

      expect(upsertArgs.create).toMatchObject({
        workspaceId: 'workspace-123',
        email: 'new@example.com',
        role: WorkspaceRole.TEACHER,
        invitedById: 'actor-123',
      });
      expect(upsertArgs.create.tokenHash).toBe(sha256(sentToken));
      expect(upsertArgs.create.tokenHash).not.toBe(sentToken);
      expect(mailMock.sendWorkspaceInvitation).toHaveBeenCalledWith('new@example.com', sentToken);
      expect(result.email).toBe('new@example.com');
    });

    it('rejects inviting a workspace owner', async () => {
      await expect(
        service.create('actor-123', 'workspace-123', 'new@example.com', WorkspaceRole.OWNER),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tx.workspaceInvitation.upsert).not.toHaveBeenCalled();
    });

    it('allows only the owner to invite administrators', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'actor-membership',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });

      await expect(
        service.create('actor-123', 'workspace-123', 'new@example.com', WorkspaceRole.ADMIN),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(tx.workspaceInvitation.upsert).not.toHaveBeenCalled();
    });

    it('allows the owner to invite administrators', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'actor-membership',
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
      });
      tx.workspaceInvitation.upsert.mockResolvedValue({
        id: 'invitation-123',
        email: 'admin@example.com',
        role: WorkspaceRole.ADMIN,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      await service.create('actor-123', 'workspace-123', 'admin@example.com', WorkspaceRole.ADMIN);

      expect(tx.workspaceInvitation.upsert).toHaveBeenCalledOnce();
    });

    it('rejects inviting an existing member', async () => {
      tx.membership.findFirst.mockResolvedValue({ id: 'membership-123' });

      await expect(
        service.create('actor-123', 'workspace-123', 'member@example.com', WorkspaceRole.TEACHER),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(tx.workspaceInvitation.upsert).not.toHaveBeenCalled();
    });

    it('keeps the invitation when the email fails to send', async () => {
      tx.workspaceInvitation.upsert.mockResolvedValue({
        id: 'invitation-123',
        email: 'new@example.com',
        role: WorkspaceRole.TEACHER,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      mailMock.sendWorkspaceInvitation.mockRejectedValue(new Error('SMTP down'));

      const result = await service.create(
        'actor-123',
        'workspace-123',
        'new@example.com',
        WorkspaceRole.TEACHER,
      );

      expect(result.id).toBe('invitation-123');
    });
  });

  describe('list', () => {
    it('lists only pending, unexpired invitations', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'actor-membership',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
      tx.workspaceInvitation.findMany.mockResolvedValue([]);

      await service.list('actor-123', 'workspace-123');

      expect(tx.workspaceInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId: 'workspace-123',
            status: InvitationStatus.PENDING,
            expiresAt: { gt: expect.any(Date) },
          },
        }),
      );
    });
  });

  describe('revoke', () => {
    beforeEach(() => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'actor-membership',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
    });

    it('rejects an unknown invitation', async () => {
      tx.workspaceInvitation.findFirst.mockResolvedValue(null);

      await expect(service.revoke('actor-123', 'workspace-123', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects an invitation that is not pending', async () => {
      tx.workspaceInvitation.findFirst.mockResolvedValue({
        id: 'invitation-123',
        status: InvitationStatus.ACCEPTED,
      });

      await expect(
        service.revoke('actor-123', 'workspace-123', 'invitation-123'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tx.workspaceInvitation.update).not.toHaveBeenCalled();
    });

    it('marks a pending invitation as revoked', async () => {
      tx.workspaceInvitation.findFirst.mockResolvedValue({
        id: 'invitation-123',
        status: InvitationStatus.PENDING,
      });

      const result = await service.revoke('actor-123', 'workspace-123', 'invitation-123');

      expect(tx.workspaceInvitation.update).toHaveBeenCalledWith({
        where: { id: 'invitation-123' },
        data: { status: InvitationStatus.REVOKED },
      });
      expect(result).toEqual({ message: 'Invitation revoked' });
    });
  });

  describe('accept', () => {
    const invitation = {
      id: 'invitation-123',
      workspaceId: 'workspace-123',
      email: 'invitee@example.com',
      role: WorkspaceRole.TEACHER,
      status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
      workspace: {
        id: 'workspace-123',
        name: 'My Tuition Class',
        type: WorkspaceType.TEACHER,
      },
    };

    it('rejects an unknown token', async () => {
      tx.workspaceInvitation.findUnique.mockResolvedValue(null);

      await expect(
        service.accept('user-123', 'invitee@example.com', 'session-123', 'unknown'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tx.workspaceInvitation.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: sha256('unknown') },
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
    });

    it('rejects an invitation that is no longer pending', async () => {
      tx.workspaceInvitation.findUnique.mockResolvedValue({
        ...invitation,
        status: InvitationStatus.REVOKED,
      });

      await expect(
        service.accept('user-123', 'invitee@example.com', 'session-123', 'token'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('marks an expired invitation as expired', async () => {
      tx.workspaceInvitation.findUnique.mockResolvedValue({
        ...invitation,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(
        service.accept('user-123', 'invitee@example.com', 'session-123', 'token'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tx.workspaceInvitation.update).toHaveBeenCalledWith({
        where: { id: 'invitation-123' },
        data: { status: InvitationStatus.EXPIRED },
      });
    });

    it('rejects accepting an invitation for another email address', async () => {
      tx.workspaceInvitation.findUnique.mockResolvedValue(invitation);

      await expect(
        service.accept('user-123', 'other@example.com', 'session-123', 'token'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(tenantMock.runAsTenant).not.toHaveBeenCalled();
    });

    it('creates the membership, accepts the invitation and switches the session', async () => {
      tx.workspaceInvitation.findUnique.mockResolvedValue(invitation);
      tx.membership.upsert.mockResolvedValue({
        id: 'membership-123',
        role: WorkspaceRole.TEACHER,
        status: MembershipStatus.ACTIVE,
      });

      const result = await service.accept(
        'user-123',
        ' INVITEE@EXAMPLE.COM ',
        'session-123',
        'token',
      );

      expect(tx.membership.upsert).toHaveBeenCalledWith({
        where: {
          userId_workspaceId: {
            userId: 'user-123',
            workspaceId: 'workspace-123',
          },
        },
        create: {
          userId: 'user-123',
          workspaceId: 'workspace-123',
          role: WorkspaceRole.TEACHER,
          status: MembershipStatus.ACTIVE,
        },
        update: {
          role: WorkspaceRole.TEACHER,
          status: MembershipStatus.ACTIVE,
        },
        select: {
          id: true,
          role: true,
          status: true,
        },
      });

      expect(tx.workspaceInvitation.update).toHaveBeenCalledWith({
        where: { id: 'invitation-123' },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: expect.any(Date),
          acceptedById: 'user-123',
        },
      });

      expect(tx.session.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'session-123',
          userId: 'user-123',
          expiresAt: { gt: expect.any(Date) },
        },
        data: { activeWorkspaceId: 'workspace-123' },
      });

      expect(result).toEqual({
        message: 'Invitation accepted',
        workspace: invitation.workspace,
        membership: {
          id: 'membership-123',
          role: WorkspaceRole.TEACHER,
          status: MembershipStatus.ACTIVE,
        },
      });
    });

    it('does not touch the session when there is no session id', async () => {
      tx.workspaceInvitation.findUnique.mockResolvedValue(invitation);
      tx.membership.upsert.mockResolvedValue({
        id: 'membership-123',
        role: WorkspaceRole.TEACHER,
        status: MembershipStatus.ACTIVE,
      });

      await service.accept('user-123', 'invitee@example.com', undefined, 'token');

      expect(tx.session.updateMany).not.toHaveBeenCalled();
    });
  });
});
