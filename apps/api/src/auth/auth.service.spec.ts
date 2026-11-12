import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';

import { Prisma } from '../generated/prisma/client.js';
import type { MailService } from '../mail/mail.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    session: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
    },
    emailVerificationToken: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const mailMock = {
    sendEmailVerification: vi.fn(),
    sendPasswordReset: vi.fn(),
    sendWorkspaceInvitation: vi.fn(),
  };

  const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

  beforeEach(() => {
    vi.resetAllMocks();

    prismaMock.$transaction.mockImplementation(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );

    service = new AuthService(
      prismaMock as unknown as PrismaService,
      mailMock as unknown as MailService,
    );
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
      expect(result.emailVerificationRequired).toBe(true);
    });

    it('should issue an email verification token and send the email', async () => {
      prismaMock.user.create.mockResolvedValue({
        id: 'user-123',
        firstName: 'Chalana',
        email: 'test@example.com',
        createdAt: new Date(),
        emailVerifiedAt: null,
      });

      await service.register({
        firstName: 'Chalana',
        email: 'test@example.com',
        password: 'StrongPassword123!',
      });

      expect(prismaMock.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });

      const tokenCall = prismaMock.emailVerificationToken.create.mock.calls[0]![0];
      const sentToken = mailMock.sendEmailVerification.mock.calls[0]![1] as string;

      expect(tokenCall.data.userId).toBe('user-123');
      expect(tokenCall.data.tokenHash).toBe(sha256(sentToken));
      expect(tokenCall.data.tokenHash).not.toBe(sentToken);
      expect(mailMock.sendEmailVerification).toHaveBeenCalledWith('test@example.com', sentToken);
    });

    it('should still create the account when the verification email fails', async () => {
      prismaMock.user.create.mockResolvedValue({
        id: 'user-123',
        firstName: 'Chalana',
        email: 'test@example.com',
        createdAt: new Date(),
        emailVerifiedAt: null,
      });
      mailMock.sendEmailVerification.mockRejectedValue(new Error('SMTP down'));

      const result = await service.register({
        firstName: 'Chalana',
        email: 'test@example.com',
        password: 'StrongPassword123!',
      });

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

  describe('email verification', () => {
    it('should mark the email as verified and consume the token', async () => {
      prismaMock.emailVerificationToken.findUnique.mockResolvedValue({
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.verifyEmail('verification-token');

      expect(prismaMock.emailVerificationToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: sha256('verification-token') },
      });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { emailVerifiedAt: expect.any(Date) },
      });
      expect(prismaMock.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
      expect(result.message).toBe('Email verified successfully');
    });

    it('should reject an expired verification token', async () => {
      prismaMock.emailVerificationToken.findUnique.mockResolvedValue({
        userId: 'user-123',
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(service.verifyEmail('expired-token')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should reject an unknown verification token', async () => {
      prismaMock.emailVerificationToken.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail('unknown-token')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should resend verification for an unverified user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        emailVerifiedAt: null,
      });

      const result = await service.resendEmailVerification('user-123');

      expect(prismaMock.emailVerificationToken.create).toHaveBeenCalledOnce();
      expect(mailMock.sendEmailVerification).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
      );
      expect(result.message).toBe('Verification email sent');
    });

    it('should not resend verification for an already verified user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        emailVerifiedAt: new Date(),
      });

      await expect(service.resendEmailVerification('user-123')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mailMock.sendEmailVerification).not.toHaveBeenCalled();
    });
  });

  describe('password reset', () => {
    it('should issue a reset token and send the email for a known address', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      });

      const result = await service.forgotPassword(' TEST@EXAMPLE.COM ');

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: { id: true, email: true },
      });

      const tokenCall = prismaMock.passwordResetToken.create.mock.calls[0]![0];
      const sentToken = mailMock.sendPasswordReset.mock.calls[0]![1] as string;

      expect(tokenCall.data.userId).toBe('user-123');
      expect(tokenCall.data.tokenHash).toBe(sha256(sentToken));
      expect(mailMock.sendPasswordReset).toHaveBeenCalledWith('test@example.com', sentToken);
      expect(result.message).toBe(
        'If that email is registered, a password reset link has been sent',
      );
    });

    it('should return the same response for an unknown address without sending mail', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('unknown@example.com');

      expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
      expect(mailMock.sendPasswordReset).not.toHaveBeenCalled();
      expect(result.message).toBe(
        'If that email is registered, a password reset link has been sent',
      );
    });

    it('should update the password, consume the token and revoke sessions', async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue({
        id: 'reset-123',
        userId: 'user-123',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.resetPassword('reset-token', 'NewPassword123!');

      expect(prismaMock.passwordResetToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: sha256('reset-token') },
      });

      const updateCall = prismaMock.user.update.mock.calls[0]![0];

      expect(updateCall.where).toEqual({ id: 'user-123' });
      expect(await argon2.verify(updateCall.data.passwordHash as string, 'NewPassword123!')).toBe(
        true,
      );

      expect(prismaMock.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'reset-123' },
        data: { usedAt: expect.any(Date) },
      });
      expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
      expect(result.message).toBe('Password reset successfully');
    });

    it('should reject a used reset token', async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue({
        id: 'reset-123',
        userId: 'user-123',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.resetPassword('used-token', 'NewPassword123!')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should reject an expired reset token', async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue({
        id: 'reset-123',
        userId: 'user-123',
        usedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(
        service.resetPassword('expired-token', 'NewPassword123!'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getCurrentSession', () => {
    it('should return the user, session id and active workspace for a valid session', async () => {
      const sessionToken = 'valid-session-token';
      const user = {
        id: 'user-123',
        firstName: 'Chalana',
        lastName: 'Nilupul',
        email: 'test@example.com',
        emailVerifiedAt: null,
      };

      prismaMock.session.findUnique.mockResolvedValue({
        id: 'session-123',
        expiresAt: new Date(Date.now() + 60_000),
        activeWorkspaceId: 'workspace-123',
        user,
      });

      const result = await service.getCurrentSession(sessionToken);

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

      expect(result).toEqual({
        user,
        sessionId: 'session-123',
        activeWorkspaceId: 'workspace-123',
      });
    });

    it('should expose getCurrentUser as a thin wrapper', async () => {
      const user = {
        id: 'user-123',
        firstName: 'Chalana',
        lastName: null,
        email: 'test@example.com',
        emailVerifiedAt: null,
      };

      prismaMock.session.findUnique.mockResolvedValue({
        id: 'session-123',
        expiresAt: new Date(Date.now() + 60_000),
        activeWorkspaceId: null,
        user,
      });

      const result = await service.getCurrentUser('valid-session-token');

      expect(result).toEqual({ user });
    });

    it('should reject a missing session token', async () => {
      await expect(service.getCurrentSession(undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(prismaMock.session.findUnique).not.toHaveBeenCalled();
    });

    it('should reject an expired session', async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: 'session-123',
        expiresAt: new Date(Date.now() - 60_000),
        activeWorkspaceId: null,
        user: {
          id: 'user-123',
          firstName: 'Chalana',
          lastName: null,
          email: 'test@example.com',
          emailVerifiedAt: null,
        },
      });

      await expect(service.getCurrentSession('expired-session-token')).rejects.toThrow(
        'Session invalid or expired',
      );
    });

    it('should reject a session that does not exist', async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);

      await expect(service.getCurrentSession('unknown-session-token')).rejects.toThrow(
        'Session invalid or expired',
      );
    });
  });
});
