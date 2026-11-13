import { ForbiddenException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/auth/auth.service.js';
import { SessionAuthGuard } from '../src/auth/session-auth.guard.js';
import { MembershipStatus, WorkspaceRole, WorkspaceType } from '../src/generated/prisma/client.js';
import { InvitationsController } from '../src/workspaces/invitations.controller.js';
import { InvitationsService } from '../src/workspaces/invitations.service.js';
import { MembershipsService } from '../src/workspaces/memberships.service.js';
import { WorkspaceAccessService } from '../src/workspaces/workspace-access.service.js';
import { WorkspaceRolesGuard } from '../src/workspaces/workspace-roles.guard.js';
import { WorkspacesController } from '../src/workspaces/workspaces.controller.js';
import { WorkspacesService } from '../src/workspaces/workspaces.service.js';

describe('Workspaces API (e2e)', () => {
  let app: INestApplication;

  const user = {
    id: 'user-123',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    emailVerifiedAt: null,
  };

  const authService = {
    getCurrentSession: vi.fn(async (token?: string) => {
      if (token !== 'valid-session') {
        throw new UnauthorizedException();
      }

      return {
        user,
        sessionId: 'session-123',
        activeWorkspaceId: null,
      };
    }),
  };

  const workspacesService = {
    create: vi.fn(),
    findAllForUser: vi.fn(),
    getById: vi.fn(),
    switchWorkspace: vi.fn(),
  };

  const membershipsService = {
    list: vi.fn(),
    updateRole: vi.fn(),
    remove: vi.fn(),
  };

  const invitationsService = {
    list: vi.fn(),
    create: vi.fn(),
    revoke: vi.fn(),
    accept: vi.fn(),
  };

  const workspaceAccessService = {
    getActiveMembership: vi.fn(),
    requireRoles: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkspacesController, InvitationsController],
      providers: [
        SessionAuthGuard,
        WorkspaceRolesGuard,
        { provide: AuthService, useValue: authService },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: MembershipsService, useValue: membershipsService },
        { provide: InvitationsService, useValue: invitationsService },
        { provide: WorkspaceAccessService, useValue: workspaceAccessService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a teacher workspace for the authenticated user', async () => {
    const workspace = {
      id: 'workspace-123',
      name: 'My Tuition Class',
      type: WorkspaceType.TEACHER,
    };

    workspacesService.create.mockResolvedValueOnce(workspace);

    await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', 'edu_session=valid-session')
      .send({
        name: 'My Tuition Class',
        type: WorkspaceType.TEACHER,
      })
      .expect(201)
      .expect(workspace);

    expect(workspacesService.create).toHaveBeenCalledWith(
      user.id,
      user.emailVerifiedAt,
      'session-123',
      expect.objectContaining({
        name: 'My Tuition Class',
        type: WorkspaceType.TEACHER,
      }),
    );
  });

  it('creates an institute workspace', async () => {
    const workspace = {
      id: 'workspace-456',
      name: 'My Institute',
      type: WorkspaceType.INSTITUTE,
    };

    workspacesService.create.mockResolvedValueOnce(workspace);

    await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', 'edu_session=valid-session')
      .send({
        name: 'My Institute',
        type: WorkspaceType.INSTITUTE,
      })
      .expect(201)
      .expect(workspace);

    expect(workspacesService.create).toHaveBeenCalledWith(
      user.id,
      user.emailVerifiedAt,
      'session-123',
      expect.objectContaining({
        name: 'My Institute',
        type: WorkspaceType.INSTITUTE,
      }),
    );
  });

  it('rejects requests that try to supply their own userId', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', 'edu_session=valid-session')
      .send({
        name: 'Another Workspace',
        type: WorkspaceType.TEACHER,
        userId: 'another-user',
      })
      .expect(400);
  });

  it('rejects invalid workspace types', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Cookie', 'edu_session=valid-session')
      .send({
        name: 'Invalid Workspace',
        type: 'INVALID',
      })
      .expect(400);
  });

  it('rejects requests without a valid session', async () => {
    await request(app.getHttpServer()).get('/api/v1/workspaces').expect(401);
  });

  it('lists workspaces for the authenticated user', async () => {
    const workspaces = [
      {
        id: 'workspace-123',
        name: 'My Tuition Class',
        type: WorkspaceType.TEACHER,
      },
    ];

    workspacesService.findAllForUser.mockResolvedValueOnce(workspaces);

    await request(app.getHttpServer())
      .get('/api/v1/workspaces')
      .set('Cookie', 'edu_session=valid-session')
      .expect(200)
      .expect(workspaces);

    expect(workspacesService.findAllForUser).toHaveBeenCalledWith(user.id);
  });

  it('switches workspace for the authenticated user', async () => {
    const result = {
      message: 'Workspace switched successfully',
      activeWorkspaceId: '123e4567-e89b-42d3-a456-426614174000',
    };

    workspacesService.switchWorkspace.mockResolvedValueOnce(result);

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/123e4567-e89b-42d3-a456-426614174000/switch')
      .set('Cookie', 'edu_session=valid-session')
      .expect(200)
      .expect(result);

    expect(workspacesService.switchWorkspace).toHaveBeenCalledWith(
      user.id,
      'session-123',
      '123e4567-e89b-42d3-a456-426614174000',
    );
  });

  it('rejects an invalid workspace ID', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/workspaces/invalid-id/switch')
      .set('Cookie', 'edu_session=valid-session')
      .expect(400);

    expect(workspacesService.switchWorkspace).not.toHaveBeenCalled();
  });

  it('rejects workspace switching without a valid session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/workspaces/123e4567-e89b-42d3-a456-426614174000/switch')
      .expect(401);

    expect(workspacesService.switchWorkspace).not.toHaveBeenCalled();
  });

  it('returns a workspace the user belongs to', async () => {
    const workspace = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      name: 'My Tuition Class',
      type: WorkspaceType.TEACHER,
    };

    workspacesService.getById.mockResolvedValueOnce(workspace);

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/123e4567-e89b-42d3-a456-426614174000')
      .set('Cookie', 'edu_session=valid-session')
      .expect(200)
      .expect(workspace);

    expect(workspacesService.getById).toHaveBeenCalledWith(
      user.id,
      '123e4567-e89b-42d3-a456-426614174000',
    );
  });

  describe('workspace members', () => {
    const workspaceId = '123e4567-e89b-42d3-a456-426614174000';
    const membershipId = '223e4567-e89b-42d3-a456-426614174000';

    it('lists members for an admin or owner', async () => {
      workspaceAccessService.getActiveMembership.mockResolvedValue({
        id: 'actor-membership',
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
      });
      membershipsService.list.mockResolvedValueOnce([]);

      await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspaceId}/members`)
        .set('Cookie', 'edu_session=valid-session')
        .expect(200)
        .expect([]);

      expect(workspaceAccessService.getActiveMembership).toHaveBeenCalledWith(user.id, workspaceId);
      expect(membershipsService.list).toHaveBeenCalledWith(user.id, workspaceId);
    });

    it('forbids members of another workspace from listing members', async () => {
      workspaceAccessService.getActiveMembership.mockRejectedValue(
        new ForbiddenException('You do not have access to this workspace'),
      );

      await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspaceId}/members`)
        .set('Cookie', 'edu_session=valid-session')
        .expect(403);

      expect(membershipsService.list).not.toHaveBeenCalled();
    });

    it('forbids members without the required role', async () => {
      workspaceAccessService.getActiveMembership.mockResolvedValue({
        id: 'actor-membership',
        role: WorkspaceRole.TEACHER,
        status: MembershipStatus.ACTIVE,
      });

      await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspaceId}/members`)
        .set('Cookie', 'edu_session=valid-session')
        .expect(403);

      expect(membershipsService.list).not.toHaveBeenCalled();
    });

    it('updates a member role for the owner', async () => {
      workspaceAccessService.getActiveMembership.mockResolvedValue({
        id: 'actor-membership',
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
      });
      membershipsService.updateRole.mockResolvedValueOnce({
        id: membershipId,
        role: WorkspaceRole.ADMIN,
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/workspaces/${workspaceId}/members/${membershipId}`)
        .set('Cookie', 'edu_session=valid-session')
        .send({ role: WorkspaceRole.ADMIN })
        .expect(200);

      expect(membershipsService.updateRole).toHaveBeenCalledWith(
        user.id,
        workspaceId,
        membershipId,
        WorkspaceRole.ADMIN,
      );
    });

    it('rejects an invalid role in the request body', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/workspaces/${workspaceId}/members/${membershipId}`)
        .set('Cookie', 'edu_session=valid-session')
        .send({ role: 'SUPER_ADMIN' })
        .expect(400);

      expect(membershipsService.updateRole).not.toHaveBeenCalled();
    });
  });

  describe('workspace invitations', () => {
    const workspaceId = '123e4567-e89b-42d3-a456-426614174000';
    const invitationId = '323e4567-e89b-42d3-a456-426614174000';

    it('creates an invitation for an admin', async () => {
      workspaceAccessService.getActiveMembership.mockResolvedValue({
        id: 'actor-membership',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
      invitationsService.create.mockResolvedValueOnce({
        id: invitationId,
        email: 'new@example.com',
        role: WorkspaceRole.TEACHER,
      });

      await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/invitations`)
        .set('Cookie', 'edu_session=valid-session')
        .send({ email: 'NEW@EXAMPLE.COM', role: WorkspaceRole.TEACHER })
        .expect(201);

      expect(invitationsService.create).toHaveBeenCalledWith(
        user.id,
        user.emailVerifiedAt,
        workspaceId,
        'new@example.com',
        WorkspaceRole.TEACHER,
      );
    });

    it('revokes an invitation for an admin', async () => {
      workspaceAccessService.getActiveMembership.mockResolvedValue({
        id: 'actor-membership',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
      invitationsService.revoke.mockResolvedValueOnce({ message: 'Invitation revoked' });

      await request(app.getHttpServer())
        .delete(`/api/v1/workspaces/${workspaceId}/invitations/${invitationId}`)
        .set('Cookie', 'edu_session=valid-session')
        .expect(200);

      expect(invitationsService.revoke).toHaveBeenCalledWith(user.id, workspaceId, invitationId);
    });

    it('accepts an invitation for the authenticated user', async () => {
      invitationsService.accept.mockResolvedValueOnce({ message: 'Invitation accepted' });

      await request(app.getHttpServer())
        .post('/api/v1/invitations/accept')
        .set('Cookie', 'edu_session=valid-session')
        .send({ token: 'invitation-token' })
        .expect(200);

      expect(invitationsService.accept).toHaveBeenCalledWith(
        user.id,
        user.email,
        user.emailVerifiedAt,
        'session-123',
        'invitation-token',
      );
    });

    it('rejects accepting an invitation without a session', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/invitations/accept')
        .send({ token: 'invitation-token' })
        .expect(401);

      expect(invitationsService.accept).not.toHaveBeenCalled();
    });
  });
});
