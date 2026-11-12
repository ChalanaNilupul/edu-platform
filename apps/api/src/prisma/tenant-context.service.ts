import { Inject, Injectable } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from './prisma.service.js';

// RLS context is transaction-scoped (`set_config(..., true)`), so a pooled
// connection cannot inherit another request's workspace after commit.
@Injectable()
export class TenantContextService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  runAsTenant<T>(
    workspaceId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT set_config('app.workspace_id', $1, true)`, workspaceId);
      return fn(tx);
    });
  }

  runAsUser<T>(userId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT set_config('app.user_id', $1, true)`, userId);
      return fn(tx);
    });
  }

  runAsSystem<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT set_config('app.bypass_rls', 'on', true)`);
      return fn(tx);
    });
  }
}
