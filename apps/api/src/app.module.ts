import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Joi from 'joi';

import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().port().default(4000),
        CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
        DATABASE_URL: Joi.string().uri().required(),
      }),
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
