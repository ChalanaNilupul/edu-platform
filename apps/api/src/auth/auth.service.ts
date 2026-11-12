import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';

import { Prisma } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { createOpaqueToken, hashToken } from './token.util.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private dummyPasswordHash?: Promise<string>;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MailService) private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    try {
      const user = await this.prisma.user.create({
        data: {
          firstName: dto.firstName.trim(),
          email,
          passwordHash,
        },
        select: {
          id: true,
          firstName: true,
          email: true,
          createdAt: true,
          emailVerifiedAt: true,
        },
      });

      try {
        await this.issueEmailVerification(user.id, user.email);
      } catch (error) {
        this.logger.error(
          'Account created but the verification email could not be sent',
          error instanceof Error ? error.stack : undefined,
        );
      }

      return {
        message: 'Account created successfully',
        emailVerificationRequired: true,
        user,
      };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Keep the work comparable to a real verification to reduce timing leaks.
      await argon2.verify(await this.getDummyPasswordHash(), dto.password);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.session.deleteMany({
      where: {
        userId: user.id,
        expiresAt: { lte: new Date() },
      },
    });

    const { token: sessionToken, tokenHash } = createOpaqueToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      sessionToken,
      expiresAt,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    };
  }

  async logout(sessionToken: string | undefined) {
    if (sessionToken) {
      await this.prisma.session.deleteMany({
        where: { tokenHash: hashToken(sessionToken) },
      });
    }

    return { message: 'Logout successful' };
  }

  async getCurrentUser(sessionToken: string | undefined) {
    const session = await this.getCurrentSession(sessionToken);

    return {
      user: session.user,
    };
  }

  async getCurrentSession(sessionToken: string | undefined) {
    if (!sessionToken) {
      throw new UnauthorizedException('Not authenticated');
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(sessionToken) },
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

    if (!session || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session invalid or expired');
    }

    return {
      user: session.user,
      sessionId: session.id,
      activeWorkspaceId: session.activeWorkspaceId,
    };
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!record || record.expiresAt <= new Date()) {
      throw new BadRequestException('Verification link is invalid or expired');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.deleteMany({
        where: { userId: record.userId },
      }),
    ]);

    return { message: 'Email verified successfully' };
  }

  async resendEmailVerification(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerifiedAt: true },
    });

    if (!user) {
      throw new UnauthorizedException('Not authenticated');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified');
    }

    await this.issueEmailVerification(user.id, user.email);

    return { message: 'Verification email sent' };
  }

  async forgotPassword(emailInput: string) {
    const email = emailInput.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (user) {
      await this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });

      const { token, tokenHash } = createOpaqueToken();

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      });

      try {
        await this.mail.sendPasswordReset(user.email, token);
      } catch (error) {
        this.logger.error(
          'Password reset email could not be sent',
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    return {
      message: 'If that email is registered, a password reset link has been sent',
    };
  }

  async resetPassword(token: string, password: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException('Reset link is invalid or expired');
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.session.deleteMany({
        where: { userId: record.userId },
      }),
    ]);

    return { message: 'Password reset successfully' };
  }

  private async issueEmailVerification(userId: string, email: string): Promise<void> {
    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId },
    });

    const { token, tokenHash } = createOpaqueToken();

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
    });

    await this.mail.sendEmailVerification(email, token);
  }

  private getDummyPasswordHash(): Promise<string> {
    this.dummyPasswordHash ??= argon2.hash('eduplatform-invalid-password-placeholder', {
      type: argon2.argon2id,
    });

    return this.dummyPasswordHash;
  }
}
