import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';

import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const allowedOrigin = configService.getOrThrow<string>('CORS_ORIGIN');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  app.use(cookieParser());

  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
  });

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return next();
  });

  // CSRF defence for cookie-authenticated state-changing requests.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

    if (!unsafeMethods.includes(req.method)) {
      return next();
    }

    const origin = req.headers.origin;
    const referer = req.headers.referer;

    if (origin) {
      if (origin !== allowedOrigin) {
        return res.status(403).json({ message: 'Forbidden origin' });
      }

      return next();
    }

    if (referer) {
      if (referer !== allowedOrigin && !referer.startsWith(`${allowedOrigin}/`)) {
        return res.status(403).json({ message: 'Forbidden origin' });
      }

      return next();
    }

    // Browsers always send Origin or Referer for unsafe requests. Requests that
    // carry a session cookie without either header are rejected to prevent CSRF.
    if (req.cookies?.edu_session) {
      return res.status(403).json({ message: 'Missing request origin' });
    }

    return next();
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('EduPlatform API')
      .setDescription('REST API for the EduPlatform education management platform.')
      .setVersion('1.0')
      .addCookieAuth('edu_session')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('PORT', 4000);

  await app.listen(port);

  console.log(`EduPlatform API running at http://localhost:${port}/api/v1`);

  if (nodeEnv !== 'production') {
    console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
  }
}

await bootstrap();
