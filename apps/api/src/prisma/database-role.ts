import { Logger } from '@nestjs/common';

import type { PrismaService } from './prisma.service.js';

type DatabaseRole = {
  role: string;
  isSuperuser: boolean;
  bypassesRls: boolean;
};

export async function assertRestrictedDatabaseRole(prisma: PrismaService, nodeEnv: string) {
  const [current] = await prisma.$queryRaw<DatabaseRole[]>`
    SELECT current_user AS "role", rolsuper AS "isSuperuser", rolbypassrls AS "bypassesRls"
    FROM pg_roles
    WHERE rolname = current_user
  `;

  if (!current || (!current.isSuperuser && !current.bypassesRls)) {
    return;
  }

  const reason = current.isSuperuser ? 'a superuser' : 'granted BYPASSRLS';
  const message =
    `Database role "${current.role}" is ${reason}, so row-level security is not enforced. ` +
    'Point DATABASE_APP_URL at a non-superuser, NOBYPASSRLS application role.';

  if (nodeEnv === 'production') {
    throw new Error(message);
  }

  new Logger('DatabaseRoleCheck').warn(message);
}
