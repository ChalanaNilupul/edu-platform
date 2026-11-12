import { Inject, Injectable, Logger } from '@nestjs/common';

import type { AuditEventType, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type AuditEventInput = {
  type: AuditEventType;
  actorUserId?: string | null;
  workspaceId?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(event: AuditEventInput): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: {
          type: event.type,
          actorUserId: event.actorUserId ?? null,
          workspaceId: event.workspaceId ?? null,
          targetId: event.targetId ?? null,
          metadata: event.metadata,
        },
      });
    } catch (error) {
      // Auditing must never break the action it describes.
      this.logger.error(
        `Failed to record audit event ${event.type}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
