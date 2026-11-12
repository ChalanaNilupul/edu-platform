import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { StudentGender, StudentStatus } from '../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class UpdateStudentDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'studentCode may only contain letters, numbers, dashes and underscores',
  })
  @MaxLength(40)
  studentCode?: string | null;

  @Transform(trim)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'dateOfBirth must be an ISO date' })
  dateOfBirth?: string | null;

  @IsOptional()
  @IsEnum(StudentGender)
  gender?: StudentGender | null;

  @Transform(normalizeEmail)
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @Transform(trim)
  @IsOptional()
  @Matches(/^[0-9+()\s-]{3,30}$/, { message: 'phone contains unsupported characters' })
  phone?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  school?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  grade?: string | null;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus | null;
}
