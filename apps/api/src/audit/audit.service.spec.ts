import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import { AuditEventType } from '../generated/prisma/client.js';
import { AuditService } from './audit.service.js';

describe('AuditService', () => {
  const prismaMock = {
    auditEvent: {
      create: vi.fn(),
    },
  };

  let service: AuditService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new AuditService(prismaMock as unknown as PrismaService);
  });

  it('stores the event with unset optional fields defaulted to null', async () => {
    prismaMock.auditEvent.create.mockResolvedValue({});

    await service.record({
      type: AuditEventType.LOGIN_SUCCEEDED,
      actorUserId: 'user-123',
    });

    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith({
      data: {
        type: AuditEventType.LOGIN_SUCCEEDED,
        actorUserId: 'user-123',
        workspaceId: null,
        targetId: null,
        metadata: undefined,
      },
    });
  });

  it('never breaks the audited action when the write fails', async () => {
    prismaMock.auditEvent.create.mockRejectedValue(new Error('database unavailable'));

    await expect(service.record({ type: AuditEventType.MEMBER_REMOVED })).resolves.toBeUndefined();
  });
});
