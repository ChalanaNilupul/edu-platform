import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/auth/auth.service.js';
import { SessionAuthGuard } from '../src/auth/session-auth.guard.js';
import { ClassScheduleController } from '../src/classes/class-schedule.controller.js';
import { ClassScheduleService } from '../src/classes/class-schedule.service.js';
import { MembershipStatus, WorkspaceRole } from '../src/generated/prisma/client.js';
import { WorkspaceAccessService } from '../src/workspaces/workspace-access.service.js';
import { WorkspaceRolesGuard } from '../src/workspaces/workspace-roles.guard.js';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const CLASS_ID = '22222222-2222-4222-8222-222222222222';
const SLOT_ID = '33333333-3333-4333-8333-333333333333';
const SUBJECT_ID = '44444444-4444-4444-8444-444444444444';
const MEMBERSHIP_ID = '55555555-5555-4555-8555-555555555555';

describe('Class schedule API (e2e)', () => {
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

  const classScheduleService = {
    listForClass: vi.fn(),
    create: vi.fn(),
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
      controllers: [ClassScheduleController],
      providers: [
        SessionAuthGuard,
        WorkspaceRolesGuard,
        { provide: AuthService, useValue: authService },
        { provide: ClassScheduleService, useValue: classScheduleService },
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

  const schedulePath = `/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/schedule`;

  it('rejects unauthenticated requests', async () => {
    const response = await agent().get(schedulePath);

    expect(response.status).toBe(401);
  });

  it('lists the weekly timetable', async () => {
    classScheduleService.listForClass.mockResolvedValue({ items: [] });

    const response = await agent().get(schedulePath).set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(200);
    expect(classScheduleService.listForClass).toHaveBeenCalledWith(user.id, WORKSPACE_ID, CLASS_ID);
  });

  it('creates a slot from the management endpoints', async () => {
    classScheduleService.create.mockResolvedValue({ id: SLOT_ID });

    const response = await agent()
      .post(schedulePath)
      .set('Cookie', 'edu_session=valid-session')
      .send({
        subjectId: SUBJECT_ID,
        membershipId: MEMBERSHIP_ID,
        dayOfWeek: 'MONDAY',
        startMinutes: 540,
        endMinutes: 600,
        room: 'Room 12',
      });

    expect(response.status).toBe(201);
    expect(classScheduleService.create).toHaveBeenCalledWith(user.id, WORKSPACE_ID, CLASS_ID, {
      subjectId: SUBJECT_ID,
      membershipId: MEMBERSHIP_ID,
      dayOfWeek: 'MONDAY',
      startMinutes: 540,
      endMinutes: 600,
      room: 'Room 12',
    });
  });

  it('accepts a slot without a teacher or room', async () => {
    classScheduleService.create.mockResolvedValue({ id: SLOT_ID });

    const response = await agent()
      .post(schedulePath)
      .set('Cookie', 'edu_session=valid-session')
      .send({
        subjectId: SUBJECT_ID,
        dayOfWeek: 'FRIDAY',
        startMinutes: 0,
        endMinutes: 1440,
      });

    expect(response.status).toBe(201);
  });

  it('rejects invalid slot payloads', async () => {
    for (const body of [
      {},
      { subjectId: 'not-a-uuid', dayOfWeek: 'MONDAY', startMinutes: 540, endMinutes: 600 },
      { subjectId: SUBJECT_ID, dayOfWeek: 'FUNDAY', startMinutes: 540, endMinutes: 600 },
      { subjectId: SUBJECT_ID, dayOfWeek: 'MONDAY', startMinutes: -1, endMinutes: 600 },
      { subjectId: SUBJECT_ID, dayOfWeek: 'MONDAY', startMinutes: 540, endMinutes: 1441 },
      { subjectId: SUBJECT_ID, dayOfWeek: 'MONDAY', startMinutes: 540.5, endMinutes: 600 },
      {
        subjectId: SUBJECT_ID,
        dayOfWeek: 'MONDAY',
        startMinutes: 540,
        endMinutes: 600,
        unknown: true,
      },
    ]) {
      const response = await agent()
        .post(schedulePath)
        .set('Cookie', 'edu_session=valid-session')
        .send(body);

      expect(response.status).toBe(400);
    }

    expect(classScheduleService.create).not.toHaveBeenCalled();
  });

  it('updates a slot', async () => {
    classScheduleService.update.mockResolvedValue({ id: SLOT_ID });

    const response = await agent()
      .patch(`${schedulePath}/${SLOT_ID}`)
      .set('Cookie', 'edu_session=valid-session')
      .send({ startMinutes: 600, endMinutes: 660, membershipId: null });

    expect(response.status).toBe(200);
    expect(classScheduleService.update).toHaveBeenCalledWith(
      user.id,
      WORKSPACE_ID,
      CLASS_ID,
      SLOT_ID,
      { startMinutes: 600, endMinutes: 660, membershipId: null },
    );
  });

  it('removes a slot', async () => {
    classScheduleService.remove.mockResolvedValue({ id: SLOT_ID });

    const response = await agent()
      .delete(`${schedulePath}/${SLOT_ID}`)
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(200);
    expect(classScheduleService.remove).toHaveBeenCalledWith(
      user.id,
      WORKSPACE_ID,
      CLASS_ID,
      SLOT_ID,
    );
  });

  it('rejects a malformed slot id', async () => {
    const response = await agent()
      .delete(`${schedulePath}/not-a-uuid`)
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(400);
    expect(classScheduleService.remove).not.toHaveBeenCalled();
  });

  it('lets teachers read but not change the timetable', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue({
      ...membership,
      role: WorkspaceRole.TEACHER,
    });
    classScheduleService.listForClass.mockResolvedValue({ items: [] });

    const read = await agent().get(schedulePath).set('Cookie', 'edu_session=valid-session');

    expect(read.status).toBe(200);

    const write = await agent().post(schedulePath).set('Cookie', 'edu_session=valid-session').send({
      subjectId: SUBJECT_ID,
      dayOfWeek: 'MONDAY',
      startMinutes: 540,
      endMinutes: 600,
    });

    expect(write.status).toBe(403);
    expect(classScheduleService.create).not.toHaveBeenCalled();
  });

  it('blocks students from the timetable', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue({
      ...membership,
      role: WorkspaceRole.STUDENT,
    });

    const response = await agent().get(schedulePath).set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(403);
    expect(classScheduleService.listForClass).not.toHaveBeenCalled();
  });
});
