import { BadRequestException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/auth/auth.service.js';
import { SessionAuthGuard } from '../src/auth/session-auth.guard.js';
import { AttendanceController } from '../src/classes/attendance.controller.js';
import { AttendanceService } from '../src/classes/attendance.service.js';
import { MembershipStatus, WorkspaceRole } from '../src/generated/prisma/client.js';
import { WorkspaceAccessService } from '../src/workspaces/workspace-access.service.js';
import { WorkspaceRolesGuard } from '../src/workspaces/workspace-roles.guard.js';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const CLASS_ID = '22222222-2222-4222-8222-222222222222';
const STUDENT_ID = '33333333-3333-4333-8333-333333333333';

const REGISTER = {
  date: '2026-11-13',
  session: null,
  students: [],
  counts: { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 },
};

const CLASS_SUMMARY = {
  classId: CLASS_ID,
  from: '2026-11-01',
  to: '2026-11-30',
  sessions: 2,
  counts: { present: 1, absent: 1, late: 1, excused: 1 },
  attended: 2,
  rate: 66.7,
  students: [],
};

const STUDENT_SUMMARY = {
  studentId: STUDENT_ID,
  from: '2026-11-01',
  to: '2026-11-30',
  sessions: 0,
  counts: { present: 0, absent: 0, late: 0, excused: 0 },
  attended: 0,
  rate: null,
  classes: [],
};

describe('Attendance API (e2e)', () => {
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

  const attendanceService = {
    getRegister: vi.fn(),
    saveRegister: vi.fn(),
    getClassSummary: vi.fn(),
    getStudentSummary: vi.fn(),
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
    attendanceService.getRegister.mockResolvedValue(REGISTER);
    attendanceService.saveRegister.mockResolvedValue(REGISTER);
    attendanceService.getClassSummary.mockResolvedValue(CLASS_SUMMARY);
    attendanceService.getStudentSummary.mockResolvedValue(STUDENT_SUMMARY);
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [
        SessionAuthGuard,
        WorkspaceRolesGuard,
        { provide: AuthService, useValue: authService },
        { provide: AttendanceService, useValue: attendanceService },
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

  const attendancePath = `/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/attendance`;

  it('rejects unauthenticated requests', async () => {
    const reads = await agent().get(`${attendancePath}?date=2026-11-13`);
    const writes = await agent()
      .put(attendancePath)
      .send({
        date: '2026-11-13',
        records: [{ studentId: STUDENT_ID, status: 'PRESENT' }],
      });

    expect(reads.status).toBe(401);
    expect(writes.status).toBe(401);
  });

  it('returns the register for a date', async () => {
    const response = await agent()
      .get(`${attendancePath}?date=2026-11-13`)
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(REGISTER);
    expect(attendanceService.getRegister).toHaveBeenCalledWith(
      user.id,
      WORKSPACE_ID,
      CLASS_ID,
      '2026-11-13',
    );
  });

  it('rejects a missing or malformed date', async () => {
    for (const query of ['', '?date=2026-02-31', '?date=13-11-2026', '?date=2026-11-13&extra=1']) {
      const response = await agent()
        .get(`${attendancePath}${query}`)
        .set('Cookie', 'edu_session=valid-session');

      expect(response.status).toBe(400);
    }

    expect(attendanceService.getRegister).not.toHaveBeenCalled();
  });

  it('rejects a malformed class id', async () => {
    const response = await agent()
      .get(`/api/v1/workspaces/${WORKSPACE_ID}/classes/not-a-uuid/attendance?date=2026-11-13`)
      .set('Cookie', 'edu_session=valid-session');

    expect(response.status).toBe(400);
    expect(attendanceService.getRegister).not.toHaveBeenCalled();
  });

  it('saves a register', async () => {
    const response = await agent()
      .put(attendancePath)
      .set('Cookie', 'edu_session=valid-session')
      .send({
        date: '2026-11-13',
        records: [
          { studentId: STUDENT_ID, status: 'LATE', note: ' Bus delay ' },
          { studentId: '44444444-4444-4444-8444-444444444444', status: 'EXCUSED' },
        ],
      });

    expect(response.status).toBe(200);
    expect(attendanceService.saveRegister).toHaveBeenCalledWith(user.id, WORKSPACE_ID, CLASS_ID, {
      date: '2026-11-13',
      records: [
        { studentId: STUDENT_ID, status: 'LATE', note: 'Bus delay' },
        { studentId: '44444444-4444-4444-8444-444444444444', status: 'EXCUSED' },
      ],
    });
  });

  it('rejects invalid register payloads', async () => {
    const base = { studentId: STUDENT_ID, status: 'PRESENT' };

    for (const body of [
      {},
      { date: '2026-11-13' },
      { date: '2026-11-13', records: [] },
      { date: '2026-11-13', records: [{ ...base, status: 'SICK' }] },
      { date: '2026-11-13', records: [{ ...base, studentId: 'not-a-uuid' }] },
      { date: '2026-11-13', records: [{ ...base, note: 'x'.repeat(201) }] },
      { date: '2026-11-13', records: [{ ...base, unknown: true }] },
      { date: '2026-13-01', records: [base] },
      { date: '2026-11-13', records: [base], extra: true },
    ]) {
      const response = await agent()
        .put(attendancePath)
        .set('Cookie', 'edu_session=valid-session')
        .send(body);

      expect(response.status).toBe(400);
    }

    expect(attendanceService.saveRegister).not.toHaveBeenCalled();
  });

  it('lets teachers reach the register endpoints', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue({
      ...membership,
      role: WorkspaceRole.TEACHER,
    });

    const read = await agent()
      .get(`${attendancePath}?date=2026-11-13`)
      .set('Cookie', 'edu_session=valid-session');
    const write = await agent()
      .put(attendancePath)
      .set('Cookie', 'edu_session=valid-session')
      .send({ date: '2026-11-13', records: [{ studentId: STUDENT_ID, status: 'PRESENT' }] });

    expect(read.status).toBe(200);
    expect(write.status).toBe(200);
    expect(attendanceService.saveRegister).toHaveBeenCalledTimes(1);
  });

  it('blocks students from the register', async () => {
    workspaceAccessService.getActiveMembership.mockResolvedValue({
      ...membership,
      role: WorkspaceRole.STUDENT,
    });

    const read = await agent()
      .get(`${attendancePath}?date=2026-11-13`)
      .set('Cookie', 'edu_session=valid-session');
    const write = await agent()
      .put(attendancePath)
      .set('Cookie', 'edu_session=valid-session')
      .send({ date: '2026-11-13', records: [{ studentId: STUDENT_ID, status: 'PRESENT' }] });

    expect(read.status).toBe(403);
    expect(write.status).toBe(403);
    expect(attendanceService.getRegister).not.toHaveBeenCalled();
    expect(attendanceService.saveRegister).not.toHaveBeenCalled();
  });

  describe('summaries', () => {
    const classSummaryPath = `/api/v1/workspaces/${WORKSPACE_ID}/classes/${CLASS_ID}/attendance/summary`;
    const studentSummaryPath = `/api/v1/workspaces/${WORKSPACE_ID}/students/${STUDENT_ID}/attendance/summary`;
    const range = 'from=2026-11-01&to=2026-11-30';

    it('rejects unauthenticated requests', async () => {
      const classRead = await agent().get(`${classSummaryPath}?${range}`);
      const studentRead = await agent().get(`${studentSummaryPath}?${range}`);

      expect(classRead.status).toBe(401);
      expect(studentRead.status).toBe(401);
    });

    it('returns the class summary for a range', async () => {
      const response = await agent()
        .get(`${classSummaryPath}?${range}`)
        .set('Cookie', 'edu_session=valid-session');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(CLASS_SUMMARY);
      expect(attendanceService.getClassSummary).toHaveBeenCalledWith(
        user.id,
        WORKSPACE_ID,
        CLASS_ID,
        '2026-11-01',
        '2026-11-30',
      );
    });

    it('returns the student summary for a range', async () => {
      const response = await agent()
        .get(`${studentSummaryPath}?${range}`)
        .set('Cookie', 'edu_session=valid-session');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(STUDENT_SUMMARY);
      expect(attendanceService.getStudentSummary).toHaveBeenCalledWith(
        user.id,
        WORKSPACE_ID,
        STUDENT_ID,
        '2026-11-01',
        '2026-11-30',
      );
    });

    it('rejects a missing or malformed range', async () => {
      for (const query of [
        '',
        '?from=2026-11-01',
        '?to=2026-11-30',
        '?from=2026-02-31&to=2026-03-01',
        '?from=01-11-2026&to=2026-11-30',
        `?${range}&extra=1`,
      ]) {
        const classRead = await agent()
          .get(`${classSummaryPath}${query}`)
          .set('Cookie', 'edu_session=valid-session');
        const studentRead = await agent()
          .get(`${studentSummaryPath}${query}`)
          .set('Cookie', 'edu_session=valid-session');

        expect(classRead.status).toBe(400);
        expect(studentRead.status).toBe(400);
      }

      expect(attendanceService.getClassSummary).not.toHaveBeenCalled();
      expect(attendanceService.getStudentSummary).not.toHaveBeenCalled();
    });

    it('surfaces an inverted or oversized range as a 400', async () => {
      attendanceService.getClassSummary.mockRejectedValue(
        new BadRequestException('from must be on or before to'),
      );

      const response = await agent()
        .get(`${classSummaryPath}?from=2026-12-01&to=2026-11-30`)
        .set('Cookie', 'edu_session=valid-session');

      expect(response.status).toBe(400);
    });

    it('rejects malformed ids', async () => {
      const classRead = await agent()
        .get(`/api/v1/workspaces/${WORKSPACE_ID}/classes/not-a-uuid/attendance/summary?${range}`)
        .set('Cookie', 'edu_session=valid-session');
      const studentRead = await agent()
        .get(`/api/v1/workspaces/${WORKSPACE_ID}/students/not-a-uuid/attendance/summary?${range}`)
        .set('Cookie', 'edu_session=valid-session');

      expect(classRead.status).toBe(400);
      expect(studentRead.status).toBe(400);
      expect(attendanceService.getClassSummary).not.toHaveBeenCalled();
      expect(attendanceService.getStudentSummary).not.toHaveBeenCalled();
    });

    it('lets teachers read summaries and blocks students', async () => {
      workspaceAccessService.getActiveMembership.mockResolvedValue({
        ...membership,
        role: WorkspaceRole.TEACHER,
      });

      const teacherRead = await agent()
        .get(`${classSummaryPath}?${range}`)
        .set('Cookie', 'edu_session=valid-session');

      expect(teacherRead.status).toBe(200);

      workspaceAccessService.getActiveMembership.mockResolvedValue({
        ...membership,
        role: WorkspaceRole.STUDENT,
      });

      const studentRead = await agent()
        .get(`${studentSummaryPath}?${range}`)
        .set('Cookie', 'edu_session=valid-session');

      expect(studentRead.status).toBe(403);
      expect(attendanceService.getStudentSummary).not.toHaveBeenCalled();
    });
  });
});
