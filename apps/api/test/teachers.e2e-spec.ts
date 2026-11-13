import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/auth/auth.service.js';
import { SessionAuthGuard } from '../src/auth/session-auth.guard.js';
import { MembershipStatus, WorkspaceRole } from '../src/generated/prisma/client.js';
import { TeachersController } from '../src/teachers/teachers.controller.js';
import { TeachersService } from '../src/teachers/teachers.service.js';
import { WorkspaceAccessService } from '../src/workspaces/workspace-access.service.js';
import { WorkspaceRolesGuard } from '../src/workspaces/workspace-roles.guard.js';

describe('Teachers API (e2e)', () => {
  let app: INestApplication;

  const user = {
    id: 'user-123',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    emailVerifiedAt: new Date(),
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

  const teachersService = {
    list: vi.fn(),
    findOne: vi.fn(),
    upsertProfile: vi.fn(),
  };

  const workspaceAccessService = {
    getActiveMembership: vi.fn(),
    requireRoles: vi.fn(),
  };

  const membership = {
    id: 'membership-actor',
    role: WorkspaceRole.ADMIN,
    status: MembershipStatus.ACTIVE,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    workspaceAccessService.getActiveMembership.mockResolvedValue(membership);
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TeachersController],
      providers: [
        SessionAuthGuard,
        WorkspaceRolesGuard,
        { provide: AuthService, useValue: authService },
        { provide: TeachersService, useValue: teachersService },
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

  function agent() {
    return request.agent(app.getHttpServer());
  }

  it('rejects unauthenticated requests', async () => {
    const response = await agent().get(
      '/api/v1/workspaces/11111111-1111-4111-8111-111111111111/teachers',
    );

    expect(response.status).toBe(401);
  });

  it('lists teachers with query parameters', async () => {
    teachersService.list.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    const response = await agent()
      .get(
        '/api/v1/workspaces/11111111-1111-4111-8111-111111111111/teachers?search=Nimal&status=ACTIVE&page=1',
      )
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(200);
    expect(teachersService.list).toHaveBeenCalledWith(
      user.id,
      '11111111-1111-4111-8111-111111111111',
      {
        search: 'Nimal',
        status: MembershipStatus.ACTIVE,
        page: 1,
      },
    );
  });

  it('returns a teacher detail', async () => {
    teachersService.findOne.mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222' });

    const response = await agent()
      .get(
        '/api/v1/workspaces/11111111-1111-4111-8111-111111111111/teachers/22222222-2222-4222-8222-222222222222',
      )
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(200);
    expect(teachersService.findOne).toHaveBeenCalledWith(
      user.id,
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    );
  });

  it('accepts a profile update from a manager', async () => {
    teachersService.upsertProfile.mockResolvedValue({ id: 'profile-123' });

    const response = await agent()
      .patch(
        '/api/v1/workspaces/11111111-1111-4111-8111-111111111111/teachers/22222222-2222-4222-8222-222222222222/profile',
      )
      .set('Cookie', 'edu_session=valid-session')
      .send({ phone: '0771234567', specializations: ['Mathematics'] });

    expect(response.status).toBe(200);
    expect(teachersService.upsertProfile).toHaveBeenCalledWith(
      user.id,
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      { phone: '0771234567', specializations: ['Mathematics'] },
    );
  });

  it('rejects an invalid profile payload', async () => {
    const response = await agent()
      .patch(
        '/api/v1/workspaces/11111111-1111-4111-8111-111111111111/teachers/22222222-2222-4222-8222-222222222222/profile',
      )
      .set('Cookie', 'edu_session=valid-session')
      .send({ joinedAt: 'not-a-date', unknownField: true });

    expect(response.status).toBe(400);
    expect(teachersService.upsertProfile).not.toHaveBeenCalled();
  });

  it('blocks students from the teacher directory', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue({
      ...membership,
      role: WorkspaceRole.STUDENT,
    });

    const response = await agent()
      .get('/api/v1/workspaces/11111111-1111-4111-8111-111111111111/teachers')
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(403);
    expect(teachersService.list).not.toHaveBeenCalled();
  });
});
