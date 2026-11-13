import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { ClassStatus } from '../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateClassDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  grade?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  capacity?: number | null;

  @IsOptional()
  @IsEnum(ClassStatus)
  status?: ClassStatus;
}
