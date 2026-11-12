import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';

describe('EduPlatform API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api/v1');

    await app.init();
  });

  it('GET /api/v1/health should return API health status', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'EduPlatform API',
    });

    expect(typeof response.body.timestamp).toBe('string');

    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });

  afterEach(async () => {
    await app.close();
  });
});
