import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/auth/auth.service.js';
import { SessionAuthGuard } from '../src/auth/session-auth.guard.js';
import { WorkspaceType } from '../src/generated/prisma/client.js';
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
    switchWorkspace: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        SessionAuthGuard,
        { provide: AuthService, useValue: authService },
        { provide: WorkspacesService, useValue: workspacesService },
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
      .expect(201)
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
});
