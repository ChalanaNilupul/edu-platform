import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ConfigService) config: ConfigService) {
    // DATABASE_URL is the migration/owner connection; runtime prefers the restricted role.
    const connectionString =
      config.get<string>('DATABASE_APP_URL') ?? config.getOrThrow<string>('DATABASE_URL');

    const adapter = new PrismaPg({
      connectionString,
    });

    super({ adapter });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
