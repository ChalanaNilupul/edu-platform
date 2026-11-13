import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { EnrollmentStatus } from '../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateEnrollmentDto {
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @IsOptional()
  @IsDateString({}, { message: 'endedAt must be an ISO date' })
  endedAt?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
