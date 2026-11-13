import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import Joi from 'joi';

import { AuthModule } from './auth/auth.module.js';
import { AuditModule } from './audit/audit.module.js';
import { ClassesModule } from './classes/classes.module.js';
import { GuardiansModule } from './guardians/guardians.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StudentsModule } from './students/students.module.js';
import { TeachersModule } from './teachers/teachers.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
        PORT: Joi.number().port().default(4000),
        CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
        APP_WEB_URL: Joi.string().uri().default('http://localhost:3000'),
        MAIL_DRIVER: Joi.string().valid('console', 'disabled').default('console'),
        TRUST_PROXY: Joi.string().default('false'),
        DATABASE_URL: Joi.string().uri().required(),
        DATABASE_APP_URL: Joi.string().uri(),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 30,
      },
    ]),
    PrismaModule,
    AuditModule,
    HealthModule,
    AuthModule,
    WorkspacesModule,
    StudentsModule,
    GuardiansModule,
    ClassesModule,
    TeachersModule,
  ],
  providers: [
    // Rate limiting is exercised separately; disable it for database integration
    // tests that issue many requests from a single address.
    ...(process.env.NODE_ENV === 'test'
      ? []
      : [
          {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
          },
        ]),
  ],
})
export class AppModule {}
