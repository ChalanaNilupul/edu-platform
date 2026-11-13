import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { GuardianRelationship } from '../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateGuardianDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsEnum(GuardianRelationship)
  relationship!: GuardianRelationship;

  @Transform(normalizeEmail)
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @Transform(trim)
  @IsOptional()
  @Matches(/^[0-9+()\s-]{3,30}$/, { message: 'phone contains unsupported characters' })
  phone?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  occupation?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
