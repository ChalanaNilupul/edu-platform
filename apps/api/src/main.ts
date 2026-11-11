import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';

import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const allowedOrigin = configService.getOrThrow<string>('CORS_ORIGIN');

  // Parse cookies from incoming requests
  app.use(cookieParser());

  // Configure frontend access
  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
  });

  // Basic CSRF protection using the Origin header
  app.use((req: Request, res: Response, next: NextFunction) => {
    const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

    if (!unsafeMethods.includes(req.method)) {
      return next();
    }

    const origin = req.headers.origin;

    // Reject requests from unexpected origins
    if (origin && origin !== allowedOrigin) {
      return res.status(403).json({
        message: 'Forbidden origin',
      });
    }

    return next();
  });

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Validate incoming request data
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger API documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('EduPlatform API')
    .setDescription('REST API for the EduPlatform education management platform.')
    .setVersion('1.0')
    .addCookieAuth('edu_session')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);

  console.log(`EduPlatform API running at http://localhost:${port}/api/v1`);
  console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}

await bootstrap();
