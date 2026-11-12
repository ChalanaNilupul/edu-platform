import { ForbiddenException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/auth/auth.service.js';
import { SessionAuthGuard } from '../src/auth/session-auth.guard.js';
import { MembershipStatus, StudentStatus, WorkspaceRole } from '../src/generated/prisma/client.js';
import { StudentsController } from '../src/students/students.controller.js';
import { StudentsService } from '../src/students/students.service.js';
import { WorkspaceAccessService } from '../src/workspaces/workspace-access.service.js';
import { WorkspaceRolesGuard } from '../src/workspaces/workspace-roles.guard.js';

const WORKSPACE_ID = '123e4567-e89b-42d3-a456-426614174000';
const STUDENT_ID = '223e4567-e89b-42d3-a456-426614174000';

describe('Students API (e2e)', () => {
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

  const studentsService = {
    list: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
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
      controllers: [StudentsController],
      providers: [
        SessionAuthGuard,
        WorkspaceRolesGuard,
        { provide: AuthService, useValue: authService },
        { provide: StudentsService, useValue: studentsService },
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

  it('lists students with parsed search, filter and pagination', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.TEACHER),
    );
    const page = { items: [], page: 2, pageSize: 5, total: 0, totalPages: 0 };
    studentsService.list.mockResolvedValueOnce(page);

    await request(app.getHttpServer())
      .get(
        `/api/v1/workspaces/${WORKSPACE_ID}/students?search=%20nimal%20&status=ACTIVE&page=2&pageSize=5`,
      )
      .set('Cookie', 'edu_session=valid-session')
      .expect(200)
      .expect(page);

    expect(workspaceAccessService.getActiveMembership).toHaveBeenCalledWith(user.id, WORKSPACE_ID);
    expect(studentsService.list).toHaveBeenCalledWith(user.id, WORKSPACE_ID, {
      search: 'nimal',
      status: StudentStatus.ACTIVE,
      page: 2,
      pageSize: 5,
    });
  });

  it('rejects invalid query parameters', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.ADMIN),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/students?status=UNKNOWN`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(400);

    expect(studentsService.list).not.toHaveBeenCalled();
  });

  it('returns a student for a teacher', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.TEACHER),
    );
    const student = { id: STUDENT_ID, firstName: 'Nimal' };
    studentsService.findOne.mockResolvedValueOnce(student);

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/students/${STUDENT_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(200)
      .expect(student);

    expect(studentsService.findOne).toHaveBeenCalledWith(user.id, WORKSPACE_ID, STUDENT_ID);
  });

  it('creates a student for a branch manager', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.BRANCH_MANAGER),
    );
    const student = { id: STUDENT_ID, firstName: 'Nimal' };
    studentsService.create.mockResolvedValueOnce(student);

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/students`)
      .set('Cookie', 'edu_session=valid-session')
      .send({
        firstName: ' Nimal ',
        studentCode: 'STU-001',
        email: 'NIMAL@EXAMPLE.COM',
        dateOfBirth: '2010-05-14',
      })
      .expect(201)
      .expect(student);

    expect(studentsService.create).toHaveBeenCalledWith(user.id, WORKSPACE_ID, {
      firstName: 'Nimal',
      studentCode: 'STU-001',
      email: 'nimal@example.com',
      dateOfBirth: '2010-05-14',
    });
  });

  it('forbids teachers from creating students', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.TEACHER),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/students`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ firstName: 'Nimal' })
      .expect(403);

    expect(studentsService.create).not.toHaveBeenCalled();
  });

  it('forbids students and parents from reading the directory', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.STUDENT),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/students`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(403);

    expect(studentsService.list).not.toHaveBeenCalled();
  });

  it('rejects invalid student data', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.ADMIN),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/students`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ firstName: '', email: 'not-an-email' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/students`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ firstName: 'Nimal', workspaceId: 'another-workspace' })
      .expect(400);

    expect(studentsService.create).not.toHaveBeenCalled();
  });

  it('updates a student status', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.ADMIN),
    );
    const updated = { id: STUDENT_ID, status: StudentStatus.WITHDRAWN };
    studentsService.update.mockResolvedValueOnce(updated);

    await request(app.getHttpServer())
      .patch(`/api/v1/workspaces/${WORKSPACE_ID}/students/${STUDENT_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ status: StudentStatus.WITHDRAWN })
      .expect(200)
      .expect(updated);

    expect(studentsService.update).toHaveBeenCalledWith(user.id, WORKSPACE_ID, STUDENT_ID, {
      status: StudentStatus.WITHDRAWN,
    });
  });

  it('rejects an invalid student ID', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.ADMIN),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/students/not-a-uuid`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(400);

    expect(studentsService.findOne).not.toHaveBeenCalled();
  });

  it('rejects requests from users without workspace access', async () => {
    workspaceAccessService.getActiveMembership.mockRejectedValue(
      new ForbiddenException('You do not have access to this workspace'),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/students`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(403);
  });

  it('rejects requests without a valid session', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/students`)
      .expect(401);

    expect(studentsService.list).not.toHaveBeenCalled();
  });
});
