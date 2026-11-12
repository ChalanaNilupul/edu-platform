import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as argon2 from 'argon2';
import type { RegisterDto } from './dto/register.dto.js';

import { randomBytes, createHash } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
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
        },
      });

      return {
        message: 'Account created successfully',
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

    // Find the user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Use the same error for invalid email or password
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify the stored Argon2 password hash
    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate a cryptographically secure session token
    const sessionToken = randomBytes(32).toString('base64url');

    // Store only the SHA-256 hash in PostgreSQL
    const tokenHash = createHash('sha256').update(sessionToken).digest('hex');

    // Session expires after 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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
      },
    };
  }

  async logout(sessionToken: string | undefined) {
    if (sessionToken) {
      const tokenHash = createHash('sha256').update(sessionToken).digest('hex');

      await this.prisma.session.deleteMany({
        where: { tokenHash },
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

    const tokenHash = createHash('sha256').update(sessionToken).digest('hex');

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
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
}
