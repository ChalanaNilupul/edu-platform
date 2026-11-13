import { ForbiddenException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/auth/auth.service.js';
import { SessionAuthGuard } from '../src/auth/session-auth.guard.js';
import { GuardiansController } from '../src/guardians/guardians.controller.js';
import { GuardiansService } from '../src/guardians/guardians.service.js';
import {
  GuardianRelationship,
  MembershipStatus,
  WorkspaceRole,
} from '../src/generated/prisma/client.js';
import { WorkspaceAccessService } from '../src/workspaces/workspace-access.service.js';
import { WorkspaceRolesGuard } from '../src/workspaces/workspace-roles.guard.js';

const WORKSPACE_ID = '123e4567-e89b-42d3-a456-426614174000';
const STUDENT_ID = '223e4567-e89b-42d3-a456-426614174000';
const GUARDIAN_ID = '323e4567-e89b-42d3-a456-426614174000';

describe('Guardians API (e2e)', () => {
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

  const guardiansService = {
    listForStudent: vi.fn(),
    findOne: vi.fn(),
    createForStudent: vi.fn(),
    update: vi.fn(),
    unlink: vi.fn(),
    remove: vi.fn(),
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
      controllers: [GuardiansController],
      providers: [
        SessionAuthGuard,
        WorkspaceRolesGuard,
        { provide: AuthService, useValue: authService },
        { provide: GuardiansService, useValue: guardiansService },
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

  it('lists a student guardians for a teacher', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.TEACHER),
    );
    const page = { items: [] };
    guardiansService.listForStudent.mockResolvedValueOnce(page);

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/students/${STUDENT_ID}/guardians`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(200)
      .expect(page);

    expect(guardiansService.listForStudent).toHaveBeenCalledWith(user.id, WORKSPACE_ID, STUDENT_ID);
  });

  it('returns a guardian with linked students for a teacher', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.TEACHER),
    );
    const guardian = { id: GUARDIAN_ID, firstName: 'Sunil', linkedStudents: [] };
    guardiansService.findOne.mockResolvedValueOnce(guardian);

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/guardians/${GUARDIAN_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(200)
      .expect(guardian);

    expect(guardiansService.findOne).toHaveBeenCalledWith(user.id, WORKSPACE_ID, GUARDIAN_ID);
  });

  it('creates a guardian for a branch manager with normalised values', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.BRANCH_MANAGER),
    );
    const created = { id: 'link-123', isPrimary: true, guardian: { id: GUARDIAN_ID } };
    guardiansService.createForStudent.mockResolvedValueOnce(created);

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/students/${STUDENT_ID}/guardians`)
      .set('Cookie', 'edu_session=valid-session')
      .send({
        firstName: ' Sunil ',
        relationship: GuardianRelationship.FATHER,
        email: 'SUNIL@EXAMPLE.COM',
        phone: '+94 77 000 0002',
        isPrimary: true,
      })
      .expect(201)
      .expect(created);

    expect(guardiansService.createForStudent).toHaveBeenCalledWith(
      user.id,
      WORKSPACE_ID,
      STUDENT_ID,
      {
        firstName: 'Sunil',
        relationship: GuardianRelationship.FATHER,
        email: 'sunil@example.com',
        phone: '+94 77 000 0002',
        isPrimary: true,
      },
    );
  });

  it('forbids teachers from creating guardians', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.TEACHER),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/students/${STUDENT_ID}/guardians`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ firstName: 'Sunil', relationship: GuardianRelationship.FATHER })
      .expect(403);

    expect(guardiansService.createForStudent).not.toHaveBeenCalled();
  });

  it('updates a guardian for an admin', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.ADMIN),
    );
    const updated = { id: GUARDIAN_ID, occupation: 'Carpenter' };
    guardiansService.update.mockResolvedValueOnce(updated);

    await request(app.getHttpServer())
      .patch(`/api/v1/workspaces/${WORKSPACE_ID}/guardians/${GUARDIAN_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ occupation: 'Carpenter' })
      .expect(200)
      .expect(updated);

    expect(guardiansService.update).toHaveBeenCalledWith(user.id, WORKSPACE_ID, GUARDIAN_ID, {
      occupation: 'Carpenter',
    });
  });

  it('unlinks a guardian from a student', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.BRANCH_MANAGER),
    );
    guardiansService.unlink.mockResolvedValueOnce(undefined);

    await request(app.getHttpServer())
      .delete(`/api/v1/workspaces/${WORKSPACE_ID}/students/${STUDENT_ID}/guardians/${GUARDIAN_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(200);

    expect(guardiansService.unlink).toHaveBeenCalledWith(
      user.id,
      WORKSPACE_ID,
      STUDENT_ID,
      GUARDIAN_ID,
    );
  });

  it('deletes an unlinked guardian', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.ADMIN),
    );
    guardiansService.remove.mockResolvedValueOnce(undefined);

    await request(app.getHttpServer())
      .delete(`/api/v1/workspaces/${WORKSPACE_ID}/guardians/${GUARDIAN_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(200);

    expect(guardiansService.remove).toHaveBeenCalledWith(user.id, WORKSPACE_ID, GUARDIAN_ID);
  });

  it('forbids teachers from unlinking or deleting guardians', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.TEACHER),
    );

    await request(app.getHttpServer())
      .delete(`/api/v1/workspaces/${WORKSPACE_ID}/students/${STUDENT_ID}/guardians/${GUARDIAN_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/workspaces/${WORKSPACE_ID}/guardians/${GUARDIAN_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(403);

    expect(guardiansService.unlink).not.toHaveBeenCalled();
    expect(guardiansService.remove).not.toHaveBeenCalled();
  });

  it('rejects invalid guardian data', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.ADMIN),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/students/${STUDENT_ID}/guardians`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ firstName: '', relationship: 'FATHER' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/students/${STUDENT_ID}/guardians`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ firstName: 'Sunil' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/students/${STUDENT_ID}/guardians`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ firstName: 'Sunil', relationship: GuardianRelationship.FATHER, isPrimary: 'yes' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${WORKSPACE_ID}/students/${STUDENT_ID}/guardians`)
      .set('Cookie', 'edu_session=valid-session')
      .send({
        firstName: 'Sunil',
        relationship: GuardianRelationship.FATHER,
        workspaceId: 'another-workspace',
      })
      .expect(400);

    expect(guardiansService.createForStudent).not.toHaveBeenCalled();
  });

  it('rejects invalid guardian IDs', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue(
      activeMembership(WorkspaceRole.ADMIN),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/guardians/not-a-uuid`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(400);

    expect(guardiansService.findOne).not.toHaveBeenCalled();
  });

  it('rejects requests from users without workspace access', async () => {
    workspaceAccessService.getActiveMembership.mockRejectedValue(
      new ForbiddenException('You do not have access to this workspace'),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/students/${STUDENT_ID}/guardians`)
      .set('Cookie', 'edu_session=valid-session')
      .expect(403);
  });

  it('rejects requests without a valid session', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/students/${STUDENT_ID}/guardians`)
      .expect(401);

    expect(guardiansService.listForStudent).not.toHaveBeenCalled();
  });
});
