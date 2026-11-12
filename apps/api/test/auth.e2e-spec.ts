import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('Authentication API (e2e)', () => {
  let app: INestApplication<App>;

  const authServiceMock = {
    register: vi.fn(),
    login: vi.fn(),
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleBuilder = Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    });

    const moduleFixture = await moduleBuilder
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();

    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');

    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a user and return HTTP 201', async () => {
      authServiceMock.register.mockResolvedValue({
        message: 'Account created successfully',
        user: {
          id: 'user-123',
          firstName: 'Chalana',
          email: 'test@example.com',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          firstName: 'Chalana',
          email: 'test@example.com',
          password: 'StrongPassword123!',
        })
        .expect(201);

      expect(response.body.message).toBe('Account created successfully');
      expect(response.body.user.email).toBe('test@example.com');
      expect(authServiceMock.register).toHaveBeenCalledOnce();
    });

    it('should reject invalid registration data', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          firstName: '',
          email: 'not-an-email',
          password: 'short',
        })
        .expect(400);

      expect(authServiceMock.register).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should authenticate and set a secure session cookie', async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      authServiceMock.login.mockResolvedValue({
        sessionToken: 'test-session-token',
        expiresAt,
        user: {
          id: 'user-123',
          firstName: 'Chalana',
          lastName: null,
          email: 'test@example.com',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'StrongPassword123!',
        })
        .expect(200);

      expect(response.body.message).toBe('Login successful');
      expect(response.body.user.email).toBe('test@example.com');

      const cookies = response.headers['set-cookie'] as unknown as string[];
      const sessionCookie = cookies.find((cookie) => cookie.startsWith('edu_session='));

      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('SameSite=Lax');
      expect(sessionCookie).toContain('Path=/');
      expect(sessionCookie).toContain('test-session-token');

      expect(authServiceMock.login).toHaveBeenCalledOnce();
    });

    it('should reject invalid login data', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: '',
        })
        .expect(400);

      expect(authServiceMock.login).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return the authenticated user', async () => {
      authServiceMock.getCurrentUser.mockResolvedValue({
        user: {
          id: 'user-123',
          firstName: 'Chalana',
          lastName: null,
          email: 'test@example.com',
          emailVerifiedAt: null,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', 'edu_session=valid-session-token')
        .expect(200);

      expect(response.body.user.email).toBe('test@example.com');
      expect(authServiceMock.getCurrentUser).toHaveBeenCalledWith('valid-session-token');
    });

    it('should reject requests without a session cookie', async () => {
      authServiceMock.getCurrentUser.mockRejectedValue(
        new UnauthorizedException('Not authenticated'),
      );

      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should delete the session and clear the cookie', async () => {
      authServiceMock.logout.mockResolvedValue({
        message: 'Logout successful',
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', 'edu_session=valid-session-token')
        .expect(200);

      expect(response.body.message).toBe('Logout successful');
      expect(authServiceMock.logout).toHaveBeenCalledWith('valid-session-token');

      const cookies = response.headers['set-cookie'] as unknown as string[];
      const clearedCookie = cookies.find((cookie) => cookie.startsWith('edu_session='));

      expect(clearedCookie).toBeDefined();
      expect(clearedCookie).toContain('HttpOnly');
      expect(clearedCookie).toContain('SameSite=Lax');
      expect(clearedCookie).toContain('Path=/');
      expect(clearedCookie).toMatch(/Expires=/i);
    });
  });
});
