import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/auth/auth.service.js';
import { SessionAuthGuard } from '../src/auth/session-auth.guard.js';
import { MembershipStatus, WorkspaceRole } from '../src/generated/prisma/client.js';
import { LessonsController } from '../src/lessons/lessons.controller.js';
import { LessonsService } from '../src/lessons/lessons.service.js';
import { WorkspaceAccessService } from '../src/workspaces/workspace-access.service.js';
import { WorkspaceRolesGuard } from '../src/workspaces/workspace-roles.guard.js';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const CLASS_ID = '22222222-2222-4222-8222-222222222222';
const LESSON_ID = '33333333-3333-4333-8333-333333333333';
const MATERIAL_ID = '44444444-4444-4444-8444-444444444444';

describe('Lessons API (e2e)', () => {
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

  const lessonsService = {
    list: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    addMaterial: vi.fn(),
    updateMaterial: vi.fn(),
    removeMaterial: vi.fn(),
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
      controllers: [LessonsController],
      providers: [
        SessionAuthGuard,
        WorkspaceRolesGuard,
        { provide: AuthService, useValue: authService },
        { provide: LessonsService, useValue: lessonsService },
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
      `/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/lessons`,
    );

    expect(response.status).toBe(401);
  });

  it('lists and filters class lessons', async () => {
    lessonsService.list.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });

    const response = await agent()
      .get(
        `/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/lessons?status=PUBLISHED&page=2&pageSize=10`,
      )
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(200);
    expect(lessonsService.list).toHaveBeenCalledWith(user.id, WORKSPACE_ID, CLASS_ID, {
      status: 'PUBLISHED',
      page: 2,
      pageSize: 10,
    });
  });

  it('creates a lesson with trimmed input', async () => {
    lessonsService.create.mockResolvedValue({ id: LESSON_ID });

    const response = await agent()
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/lessons`)
      .set('Cookie', 'edu_session=valid-session')
      .send({
        title: '  Fractions  ',
        lessonDate: '2026-11-10',
        description: '  Intro  ',
        subjectId: '55555555-5555-4555-8555-555555555555',
      });

    expect(response.status).toBe(201);
    expect(lessonsService.create).toHaveBeenCalledWith(user.id, WORKSPACE_ID, CLASS_ID, {
      title: 'Fractions',
      lessonDate: '2026-11-10',
      description: 'Intro',
      subjectId: '55555555-5555-4555-8555-555555555555',
    });
  });

  it('rejects malformed lesson payloads', async () => {
    for (const body of [
      { title: '   ', lessonDate: '2026-11-10' },
      { title: 'Fractions', lessonDate: '10-11-2026' },
      { title: 'Fractions', lessonDate: '2026-11-10', status: 'LIVE' },
      { title: 'Fractions', lessonDate: '2026-11-10', unknown: true },
    ]) {
      const response = await agent()
        .post(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/lessons`)
        .set('Cookie', 'edu_session=valid-session')
        .send(body);

      expect(response.status).toBe(400);
    }

    expect(lessonsService.create).not.toHaveBeenCalled();
  });

  it('reads, updates and deletes a lesson', async () => {
    lessonsService.findOne.mockResolvedValue({ id: LESSON_ID });
    lessonsService.update.mockResolvedValue({ id: LESSON_ID, status: 'PUBLISHED' });
    lessonsService.remove.mockResolvedValue(undefined);

    await agent()
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/lessons/${LESSON_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(200);

    await agent()
      .patch(`/api/v1/workspaces/${WORKSPACE_ID}/lessons/${LESSON_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ status: 'PUBLISHED' })
      .expect(200);

    await agent()
      .delete(`/api/v1/workspaces/${WORKSPACE_ID}/lessons/${LESSON_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(204);

    expect(lessonsService.findOne).toHaveBeenCalledWith(user.id, WORKSPACE_ID, LESSON_ID);
    expect(lessonsService.update).toHaveBeenCalledWith(user.id, WORKSPACE_ID, LESSON_ID, {
      status: 'PUBLISHED',
    });
    expect(lessonsService.remove).toHaveBeenCalledWith(user.id, WORKSPACE_ID, LESSON_ID);
  });

  it('adds, updates and removes materials', async () => {
    lessonsService.addMaterial.mockResolvedValue({ id: MATERIAL_ID });
    lessonsService.updateMaterial.mockResolvedValue({ id: MATERIAL_ID, title: 'Slides v2' });
    lessonsService.removeMaterial.mockResolvedValue(undefined);

    await agent()
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/lessons/${LESSON_ID}/materials`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ title: 'Slides', kind: 'PDF', url: 'https://example.com/slides.pdf' })
      .expect(201);

    await agent()
      .patch(`/api/v1/workspaces/${WORKSPACE_ID}/materials/${MATERIAL_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ title: 'Slides v2' })
      .expect(200);

    await agent()
      .delete(`/api/v1/workspaces/${WORKSPACE_ID}/materials/${MATERIAL_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(204);

    expect(lessonsService.addMaterial).toHaveBeenCalledWith(user.id, WORKSPACE_ID, LESSON_ID, {
      title: 'Slides',
      kind: 'PDF',
      url: 'https://example.com/slides.pdf',
    });
    expect(lessonsService.updateMaterial).toHaveBeenCalledWith(user.id, WORKSPACE_ID, MATERIAL_ID, {
      title: 'Slides v2',
    });
    expect(lessonsService.removeMaterial).toHaveBeenCalledWith(user.id, WORKSPACE_ID, MATERIAL_ID);
  });

  it('rejects invalid material kinds and urls', async () => {
    for (const body of [
      { title: 'Slides', kind: 'FILE', url: 'https://example.com/slides.pdf' },
      { title: 'Slides', kind: 'PDF', url: 'not-a-url' },
      { title: 'Slides', kind: 'PDF', url: 'ftp://example.com/slides.pdf' },
      { title: 'Slides', kind: 'PDF' },
    ]) {
      const response = await agent()
        .post(`/api/v1/workspaces/${WORKSPACE_ID}/lessons/${LESSON_ID}/materials`)
        .set('Cookie', 'edu_session=valid-session')
        .send(body);

      expect(response.status).toBe(400);
    }

    expect(lessonsService.addMaterial).not.toHaveBeenCalled();
  });

  it('rejects malformed ids', async () => {
    await agent()
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/lessons/not-a-uuid`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(400);

    expect(lessonsService.findOne).not.toHaveBeenCalled();
  });

  it('blocks students from the lesson routes', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue({
      ...membership,
      role: WorkspaceRole.STUDENT,
    });

    const response = await agent()
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/lessons`)
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(403);
    expect(lessonsService.list).not.toHaveBeenCalled();
  });
});
