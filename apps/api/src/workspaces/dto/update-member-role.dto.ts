import { IsEnum } from 'class-validator';

import { WorkspaceRole } from '../../generated/prisma/client.js';

export class UpdateMemberRoleDto {
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}
