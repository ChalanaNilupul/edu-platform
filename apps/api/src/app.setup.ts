import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';

const UNSAFE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export function configureApp(app: INestApplication, configService: ConfigService) {
  const allowedOrigin = configService.getOrThrow<string>('CORS_ORIGIN');

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
    if (!UNSAFE_METHODS.includes(req.method)) {
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
}
