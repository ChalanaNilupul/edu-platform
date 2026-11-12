import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from './prisma.service.js';
import { assertRestrictedDatabaseRole } from './database-role.js';

describe('assertRestrictedDatabaseRole', () => {
  const prismaMock = {
    $queryRaw: vi.fn(),
  };

  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  const run = (nodeEnv: string) =>
    assertRestrictedDatabaseRole(prismaMock as unknown as PrismaService, nodeEnv);

  it('accepts a role without superuser or BYPASSRLS', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { role: 'edu_app', isSuperuser: false, bypassesRls: false },
    ]);

    await expect(run('production')).resolves.toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('fails in production when the role is a superuser', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { role: 'edu_admin', isSuperuser: true, bypassesRls: true },
    ]);

    await expect(run('production')).rejects.toThrow(/row-level security is not enforced/);
  });

  it('fails in production when the role has BYPASSRLS', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { role: 'edu_admin', isSuperuser: false, bypassesRls: true },
    ]);

    await expect(run('production')).rejects.toThrow(/granted BYPASSRLS/);
  });

  it('warns but continues outside production', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { role: 'edu_admin', isSuperuser: true, bypassesRls: true },
    ]);

    await expect(run('development')).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('row-level security'));
  });
});
