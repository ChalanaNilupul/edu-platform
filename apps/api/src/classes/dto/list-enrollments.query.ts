import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { EnrollmentStatus } from '../../generated/prisma/client.js';

const toNumber = ({ value }: { value: unknown }) => {
  if (value === undefined || value === '') {
    return undefined;
  }

  return Number(value);
};

export class ListEnrollmentsQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @Transform(toNumber)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @Transform(toNumber)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
