import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/auth/auth.service.js';
import { SessionAuthGuard } from '../src/auth/session-auth.guard.js';
import { MembershipStatus, WorkspaceRole } from '../src/generated/prisma/client.js';
import { SubjectsController } from '../src/subjects/subjects.controller.js';
import { SubjectsService } from '../src/subjects/subjects.service.js';
import { WorkspaceAccessService } from '../src/workspaces/workspace-access.service.js';
import { WorkspaceRolesGuard } from '../src/workspaces/workspace-roles.guard.js';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const SUBJECT_ID = '22222222-2222-4222-8222-222222222222';
const CLASS_ID = '33333333-3333-4333-8333-333333333333';

describe('Subjects API (e2e)', () => {
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

  const subjectsService = {
    list: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    listForClass: vi.fn(),
    replaceForClass: vi.fn(),
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
      controllers: [SubjectsController],
      providers: [
        SessionAuthGuard,
        WorkspaceRolesGuard,
        { provide: AuthService, useValue: authService },
        { provide: SubjectsService, useValue: subjectsService },
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
    const response = await agent().get(`/api/v1/workspaces/${WORKSPACE_ID}/subjects`);

    expect(response.status).toBe(401);
  });

  it('lists subjects with search, status and pagination', async () => {
    subjectsService.list.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });

    const response = await agent()
      .get(
        `/api/v1/workspaces/${WORKSPACE_ID}/subjects?search=math&status=ACTIVE&page=2&pageSize=10`,
      )
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(200);
    expect(subjectsService.list).toHaveBeenCalledWith(user.id, WORKSPACE_ID, {
      search: 'math',
      status: 'ACTIVE',
      page: 2,
      pageSize: 10,
    });
  });

  it('creates a subject with a normalised code', async () => {
    subjectsService.create.mockResolvedValue({ id: SUBJECT_ID });

    const response = await agent()
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/subjects`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ name: '  Mathematics  ', code: ' math ', description: 'Core subject' });

    expect(response.status).toBe(201);
    expect(subjectsService.create).toHaveBeenCalledWith(user.id, WORKSPACE_ID, {
      name: 'Mathematics',
      code: 'MATH',
      description: 'Core subject',
    });
  });

  it('rejects an empty subject name', async () => {
    const response = await agent()
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/subjects`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ name: '   ' });

    expect(response.status).toBe(400);
    expect(subjectsService.create).not.toHaveBeenCalled();
  });

  it('updates a subject', async () => {
    subjectsService.update.mockResolvedValue({ id: SUBJECT_ID });

    const response = await agent()
      .patch(`/api/v1/workspaces/${WORKSPACE_ID}/subjects/${SUBJECT_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ status: 'ARCHIVED' });

    expect(response.status).toBe(200);
    expect(subjectsService.update).toHaveBeenCalledWith(user.id, WORKSPACE_ID, SUBJECT_ID, {
      status: 'ARCHIVED',
    });
  });

  it('deletes a subject', async () => {
    subjectsService.remove.mockResolvedValue(undefined);

    const response = await agent()
      .delete(`/api/v1/workspaces/${WORKSPACE_ID}/subjects/${SUBJECT_ID}`)
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(200);
    expect(subjectsService.remove).toHaveBeenCalledWith(user.id, WORKSPACE_ID, SUBJECT_ID);
  });

  it('lists the subjects of a class', async () => {
    subjectsService.listForClass.mockResolvedValue({ items: [] });

    const response = await agent()
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/subjects`)
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(200);
    expect(subjectsService.listForClass).toHaveBeenCalledWith(user.id, WORKSPACE_ID, CLASS_ID);
  });

  it('replaces the subjects of a class', async () => {
    subjectsService.replaceForClass.mockResolvedValue({ items: [] });

    const response = await agent()
      .put(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/subjects`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ subjectIds: [SUBJECT_ID] });

    expect(response.status).toBe(200);
    expect(subjectsService.replaceForClass).toHaveBeenCalledWith(user.id, WORKSPACE_ID, CLASS_ID, [
      SUBJECT_ID,
    ]);
  });

  it('rejects duplicate or malformed subject ids', async () => {
    const duplicate = await agent()
      .put(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/subjects`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ subjectIds: [SUBJECT_ID, SUBJECT_ID] });

    expect(duplicate.status).toBe(400);

    const malformed = await agent()
      .delete(`/api/v1/workspaces/${WORKSPACE_ID}/subjects/not-a-uuid`)
      .set('Cookie', 'edu_session=valid-session');

    expect(malformed.status).toBe(400);
    expect(subjectsService.replaceForClass).not.toHaveBeenCalled();
    expect(subjectsService.remove).not.toHaveBeenCalled();
  });

  it('blocks students from the subject directory', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue({
      ...membership,
      role: WorkspaceRole.STUDENT,
    });

    const response = await agent()
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/subjects`)
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(403);
    expect(subjectsService.list).not.toHaveBeenCalled();
  });
});
