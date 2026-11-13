import { NotFoundException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/auth/auth.service.js';
import { SessionAuthGuard } from '../src/auth/session-auth.guard.js';
import { ClassesController } from '../src/classes/classes.controller.js';
import { ClassesService } from '../src/classes/classes.service.js';
import { EnrollmentsController } from '../src/classes/enrollments.controller.js';
import { EnrollmentsService } from '../src/classes/enrollments.service.js';
import { ClassStatus, MembershipStatus, WorkspaceRole } from '../src/generated/prisma/client.js';
import { WorkspaceAccessService } from '../src/workspaces/workspace-access.service.js';
import { WorkspaceRolesGuard } from '../src/workspaces/workspace-roles.guard.js';

const WORKSPACE_ID = '123e4567-e89b-42d3-a456-426614174000';
const CLASS_ID = '323e4567-e89b-42d3-a456-426614174000';
const STUDENT_ID = '223e4567-e89b-42d3-a456-426614174000';
const ENROLLMENT_ID = '423e4567-e89b-42d3-a456-426614174000';

describe('Classes API (e2e)', () => {
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

  const classesService = {
    list: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const enrollmentsService = {
    listForClass: vi.fn(),
    listForStudent: vi.fn(),
    enroll: vi.fn(),
    update: vi.fn(),
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
      controllers: [ClassesController, EnrollmentsController],
      providers: [
        SessionAuthGuard,
        WorkspaceRolesGuard,
        { provide: AuthService, useValue: authService },
        { provide: ClassesService, useValue: classesService },
        { provide: EnrollmentsService, useValue: enrollmentsService },
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

  function activeMembership(role: WorkspaceRole) {
    return { id: 'membership-123', role, status: MembershipStatus.ACTIVE };
  }

  it('lists classes with parsed search, status and pagination', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.TEACHER),
    );
    const page = { items: [], page: 2, pageSize: 5, total: 0, totalPages: 0 };
    classesService.list.mockResolvedValueOnce(page);

    await request(app.getHttpServer())
      .get(
        `/api/v1/workspaces/${WORKSPACE_ID}/classes?search=%20science%20&status=ARCHIVED&page=2&pageSize=5`,
      )
      .set('Cookie', 'edu_session=valid-session')
      .expect(200)
      .expect(page);

    expect(classesService.list).toHaveBeenCalledWith(user.id, WORKSPACE_ID, {
      search: 'science',
      status: ClassStatus.ARCHIVED,
      page: 2,
      pageSize: 5,
    });
  });

  it('returns a class and surfaces a not found result', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.ADMIN),
    );
    const schoolClass = { id: CLASS_ID, name: 'Grade 8 Science', enrolledCount: 3 };
    classesService.findOne.mockResolvedValueOnce(schoolClass);

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(200)
      .expect(schoolClass);

    classesService.findOne.mockRejectedValueOnce(new NotFoundException('Class not found'));

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(404);
  });

  it('creates a class for a branch manager', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.BRANCH_MANAGER),
    );
    const created = { id: CLASS_ID, name: 'Grade 8 Science', status: ClassStatus.ACTIVE };
    classesService.create.mockResolvedValueOnce(created);

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/classes`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ name: '  Grade 8 Science ', capacity: 30 })
      .expect(201)
      .expect(created);

    expect(classesService.create).toHaveBeenCalledWith(user.id, WORKSPACE_ID, {
      name: 'Grade 8 Science',
      capacity: 30,
    });
  });

  it('forbids teachers from creating, updating or deleting classes', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.TEACHER),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/classes`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ name: 'Grade 8 Science' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ name: 'Grade 9 Science' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(403);

    expect(classesService.create).not.toHaveBeenCalled();
    expect(classesService.update).not.toHaveBeenCalled();
    expect(classesService.remove).not.toHaveBeenCalled();
  });

  it('rejects invalid class payloads', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.ADMIN),
    );

    for (const body of [
      {},
      { name: '   ' },
      { name: 'Grade 8', capacity: 0 },
      { name: 'Grade 8', capacity: 2.5 },
      { name: 'Grade 8', extra: 'x' },
    ]) {
      await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${WORKSPACE_ID}/classes`)
        .set('Cookie', 'edu_session=valid-session')
        .send(body)
        .expect(400);
    }

    expect(classesService.create).not.toHaveBeenCalled();
  });

  it('updates a class and validates its status', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.ADMIN),
    );
    classesService.update.mockResolvedValueOnce({ id: CLASS_ID, capacity: null });

    await request(app.getHttpServer())
      .patch(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ capacity: null, status: ClassStatus.ARCHIVED })
      .expect(200);

    expect(classesService.update).toHaveBeenCalledWith(user.id, WORKSPACE_ID, CLASS_ID, {
      capacity: null,
      status: ClassStatus.ARCHIVED,
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ status: 'RETIRED' })
      .expect(400);
  });

  it('deletes a class for a manager', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.ADMIN),
    );

    await request(app.getHttpServer())
      .delete(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(200);

    expect(classesService.remove).toHaveBeenCalledWith(user.id, WORKSPACE_ID, CLASS_ID);
  });

  it('lists the roster with parsed filters', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.TEACHER),
    );
    const page = { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    enrollmentsService.listForClass.mockResolvedValueOnce(page);

    await request(app.getHttpServer())
      .get(
        `/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/enrollments?search=%20kamal%20&status=ACTIVE`,
      )
      .set('Cookie', 'edu_session=valid-session')
      .expect(200)
      .expect(page);

    expect(enrollmentsService.listForClass).toHaveBeenCalledWith(user.id, WORKSPACE_ID, CLASS_ID, {
      search: 'kamal',
      status: 'ACTIVE',
    });
  });

  it('enrolls a student for a manager and rejects teachers', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.BRANCH_MANAGER),
    );
    const enrollment = { id: ENROLLMENT_ID, studentId: STUDENT_ID, status: 'ACTIVE' };
    enrollmentsService.enroll.mockResolvedValueOnce(enrollment);

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/enrollments`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ studentId: STUDENT_ID, enrolledAt: '2026-01-05' })
      .expect(201)
      .expect(enrollment);

    expect(enrollmentsService.enroll).toHaveBeenCalledWith(user.id, WORKSPACE_ID, CLASS_ID, {
      studentId: STUDENT_ID,
      enrolledAt: '2026-01-05',
    });

    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.TEACHER),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/enrollments`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ studentId: STUDENT_ID })
      .expect(403);
  });

  it('rejects invalid enrollment payloads', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.ADMIN),
    );

    for (const body of [
      {},
      { studentId: 'not-a-uuid' },
      { studentId: STUDENT_ID, enrolledAt: 'yesterday' },
      { studentId: STUDENT_ID, extra: 'x' },
    ]) {
      await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/enrollments`)
        .set('Cookie', 'edu_session=valid-session')
        .send(body)
        .expect(400);
    }

    expect(enrollmentsService.enroll).not.toHaveBeenCalled();
  });

  it('returns a student enrollment history', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.TEACHER),
    );
    enrollmentsService.listForStudent.mockResolvedValueOnce([]);

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/students/${STUDENT_ID}/enrollments`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(200)
      .expect([]);

    expect(enrollmentsService.listForStudent).toHaveBeenCalledWith(
      user.id,
      WORKSPACE_ID,
      STUDENT_ID,
    );
  });

  it('updates an enrollment and validates the payload', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.ADMIN),
    );
    enrollmentsService.update.mockResolvedValueOnce({ id: ENROLLMENT_ID, status: 'COMPLETED' });

    await request(app.getHttpServer())
      .patch(`/api/v1/workspaces/${WORKSPACE_ID}/enrollments/${ENROLLMENT_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ status: 'COMPLETED', endedAt: '2026-06-30' })
      .expect(200);

    expect(enrollmentsService.update).toHaveBeenCalledWith(user.id, WORKSPACE_ID, ENROLLMENT_ID, {
      status: 'COMPLETED',
      endedAt: '2026-06-30',
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/workspaces/${WORKSPACE_ID}/enrollments/${ENROLLMENT_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ status: 'DROPPED' })
      .expect(400);
  });

  it('rejects malformed identifiers', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.ADMIN),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/classes/not-a-uuid`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/workspaces/${WORKSPACE_ID}/enrollments/not-a-uuid`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ notes: 'x' })
      .expect(400);
  });

  it('requires a session for every route', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/classes`)
      .expect(401);

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/enrollments`)
      .send({ studentId: STUDENT_ID })
      .expect(401);
  });
});
