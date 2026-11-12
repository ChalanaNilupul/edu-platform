import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, MaxLength } from 'class-validator';

import { WorkspaceRole } from '../../generated/prisma/client.js';

export class InviteMemberDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}
