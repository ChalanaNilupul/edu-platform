import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import { AuthService } from './auth.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    session: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(prismaMock as unknown as PrismaService);
  });

  describe('register', () => {
    it('should normalize email, trim first name and hash the password', async () => {
      const createdAt = new Date();

      prismaMock.user.create.mockResolvedValue({
        id: 'user-123',
        firstName: 'Chalana',
        email: 'test@example.com',
        createdAt,
      });

      const result = await service.register({
        firstName: ' Chalana ',
        email: ' TEST@EXAMPLE.COM ',
        password: 'StrongPassword123!',
      });

      const createCall = prismaMock.user.create.mock.calls[0];

      expect(createCall).toBeDefined();

      const createArgs = createCall![0];

      expect(createArgs.data.firstName).toBe('Chalana');
      expect(createArgs.data.email).toBe('test@example.com');
      expect(createArgs.data.passwordHash).not.toBe('StrongPassword123!');

      expect(await argon2.verify(createArgs.data.passwordHash, 'StrongPassword123!')).toBe(true);

      expect(result.user.email).toBe('test@example.com');
      expect(result.message).toBe('Account created successfully');
    });

    it('should reject duplicate email addresses', async () => {
      const duplicateError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.1',
      });

      prismaMock.user.create.mockRejectedValue(duplicateError);

      await expect(
        service.register({
          firstName: 'Chalana',
          email: 'test@example.com',
          password: 'StrongPassword123!',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('should authenticate a valid user and create a session', async () => {
      const passwordHash = await argon2.hash('StrongPassword123!');
      const user = {
        id: 'user-123',
        firstName: 'Chalana',
        lastName: 'Nilupul',
        email: 'test@example.com',
        passwordHash,
      };

      prismaMock.user.findUnique.mockResolvedValue(user);
      prismaMock.session.create.mockResolvedValue({ id: 'session-123' });

      const startTime = Date.now();

      const result = await service.login({
        email: ' TEST@EXAMPLE.COM ',
        password: 'StrongPassword123!',
      });

      const sessionCall = prismaMock.session.create.mock.calls[0];

      expect(sessionCall).toBeDefined();

      const sessionArgs = sessionCall![0];
      const expectedTokenHash = createHash('sha256').update(result.sessionToken).digest('hex');

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });

      expect(sessionArgs.data.userId).toBe('user-123');
      expect(sessionArgs.data.tokenHash).toBe(expectedTokenHash);
      expect(sessionArgs.data.tokenHash).not.toBe(result.sessionToken);

      expect(result.user.email).toBe('test@example.com');
      expect(result.sessionToken).toBeTruthy();

      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      expect(sessionArgs.data.expiresAt.getTime()).toBeGreaterThanOrEqual(startTime + sevenDays);
    });

    it('should reject an unknown email address', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'unknown@example.com',
          password: 'StrongPassword123!',
        }),
      ).rejects.toThrow('Invalid email or password');

      expect(prismaMock.session.create).not.toHaveBeenCalled();
    });

    it('should reject an incorrect password', async () => {
      const passwordHash = await argon2.hash('CorrectPassword123!');

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        firstName: 'Chalana',
        lastName: null,
        email: 'test@example.com',
        passwordHash,
      });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        }),
      ).rejects.toThrow('Invalid email or password');

      expect(prismaMock.session.create).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should delete the session using its hashed token', async () => {
      const sessionToken = 'test-session-token';

      prismaMock.session.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.logout(sessionToken);

      const expectedTokenHash = createHash('sha256').update(sessionToken).digest('hex');

      expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
        where: { tokenHash: expectedTokenHash },
      });

      expect(result.message).toBe('Logout successful');
    });

    it('should succeed without a session token', async () => {
      const result = await service.logout(undefined);

      expect(prismaMock.session.deleteMany).not.toHaveBeenCalled();
      expect(result.message).toBe('Logout successful');
    });
  });

  describe('getCurrentUser', () => {
    it('should return the user for a valid session', async () => {
      const sessionToken = 'valid-session-token';
      const user = {
        id: 'user-123',
        firstName: 'Chalana',
        lastName: 'Nilupul',
        email: 'test@example.com',
        emailVerifiedAt: null,
      };

      prismaMock.session.findUnique.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user,
      });

      const result = await service.getCurrentUser(sessionToken);

      const expectedTokenHash = createHash('sha256').update(sessionToken).digest('hex');

      expect(prismaMock.session.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: expectedTokenHash },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              emailVerifiedAt: true,
            },
          },
        },
      });

      expect(result.user).toEqual(user);
    });

    it('should reject a missing session token', async () => {
      await expect(service.getCurrentUser(undefined)).rejects.toThrow('Not authenticated');

      expect(prismaMock.session.findUnique).not.toHaveBeenCalled();
    });

    it('should reject an expired session', async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        expiresAt: new Date(Date.now() - 60_000),
        user: {
          id: 'user-123',
          firstName: 'Chalana',
          lastName: null,
          email: 'test@example.com',
          emailVerifiedAt: null,
        },
      });

      await expect(service.getCurrentUser('expired-session-token')).rejects.toThrow(
        'Session invalid or expired',
      );
    });

    it('should reject a session that does not exist', async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);

      await expect(service.getCurrentUser('unknown-session-token')).rejects.toThrow(
        'Session invalid or expired',
      );
    });
  });
});
