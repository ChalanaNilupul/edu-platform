import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { assertRestrictedDatabaseRole } from './prisma/database-role.js';
import { PrismaService } from './prisma/prisma.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const nodeEnv = configService.getOrThrow<string>('NODE_ENV');

  await assertRestrictedDatabaseRole(app.get(PrismaService), nodeEnv);

  configureApp(app, configService);

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
