import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/auth/auth.service.js';
import { SessionAuthGuard } from '../src/auth/session-auth.guard.js';
import { ClassTeachersController } from '../src/classes/class-teachers.controller.js';
import { ClassTeachersService } from '../src/classes/class-teachers.service.js';
import { MembershipStatus, WorkspaceRole } from '../src/generated/prisma/client.js';
import { WorkspaceAccessService } from '../src/workspaces/workspace-access.service.js';
import { WorkspaceRolesGuard } from '../src/workspaces/workspace-roles.guard.js';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const CLASS_ID = '22222222-2222-4222-8222-222222222222';
const ASSIGNMENT_ID = '33333333-3333-4333-8333-333333333333';
const MEMBERSHIP_ID = '44444444-4444-4444-8444-444444444444';

describe('Class teachers API (e2e)', () => {
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

  const classTeachersService = {
    listForClass: vi.fn(),
    listForTeacher: vi.fn(),
    assign: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
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
      controllers: [ClassTeachersController],
      providers: [
        SessionAuthGuard,
        WorkspaceRolesGuard,
        { provide: AuthService, useValue: authService },
        { provide: ClassTeachersService, useValue: classTeachersService },
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
      `/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/teachers`,
    );

    expect(response.status).toBe(401);
  });

  it('lists class teachers and passes the history flag', async () => {
    classTeachersService.listForClass.mockResolvedValue({ items: [], past: [] });

    const response = await agent()
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/teachers?includeEnded=true`)
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(200);
    expect(classTeachersService.listForClass).toHaveBeenCalledWith(
      user.id,
      WORKSPACE_ID,
      CLASS_ID,
      {
        includeEnded: true,
      },
    );
  });

  it('assigns a teacher from the management endpoints', async () => {
    classTeachersService.assign.mockResolvedValue({ id: ASSIGNMENT_ID });

    const response = await agent()
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/teachers`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ membershipId: MEMBERSHIP_ID, isPrimary: true });

    expect(response.status).toBe(201);
    expect(classTeachersService.assign).toHaveBeenCalledWith(user.id, WORKSPACE_ID, CLASS_ID, {
      membershipId: MEMBERSHIP_ID,
      isPrimary: true,
    });
  });

  it('rejects an assignment without a membership id', async () => {
    const response = await agent()
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/teachers`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ isPrimary: true });

    expect(response.status).toBe(400);
    expect(classTeachersService.assign).not.toHaveBeenCalled();
  });

  it('changes the primary teacher flag', async () => {
    classTeachersService.update.mockResolvedValue({ id: ASSIGNMENT_ID });

    const response = await agent()
      .patch(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/teachers/${ASSIGNMENT_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ isPrimary: true });

    expect(response.status).toBe(200);
    expect(classTeachersService.update).toHaveBeenCalledWith(
      user.id,
      WORKSPACE_ID,
      CLASS_ID,
      ASSIGNMENT_ID,
      { isPrimary: true },
    );
  });

  it('ends an assignment', async () => {
    classTeachersService.remove.mockResolvedValue({ id: ASSIGNMENT_ID, endedAt: new Date() });

    const response = await agent()
      .delete(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/teachers/${ASSIGNMENT_ID}`)
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(200);
    expect(classTeachersService.remove).toHaveBeenCalledWith(
      user.id,
      WORKSPACE_ID,
      CLASS_ID,
      ASSIGNMENT_ID,
    );
  });

  it('lists a teacher assignment history', async () => {
    classTeachersService.listForTeacher.mockResolvedValue({ items: [], past: [] });

    const response = await agent()
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/teachers/${MEMBERSHIP_ID}/classes`)
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(200);
    expect(classTeachersService.listForTeacher).toHaveBeenCalledWith(
      user.id,
      WORKSPACE_ID,
      MEMBERSHIP_ID,
    );
  });

  it('rejects a malformed assignment id', async () => {
    const response = await agent()
      .delete(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/teachers/not-a-uuid`)
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(400);
    expect(classTeachersService.remove).not.toHaveBeenCalled();
  });

  it('blocks students from assignments', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue({
      ...membership,
      role: WorkspaceRole.STUDENT,
    });

    const response = await agent()
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/teachers`)
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(403);
    expect(classTeachersService.listForClass).not.toHaveBeenCalled();
  });
});
