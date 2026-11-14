import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { LessonStatus } from '../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimNullable = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.length === 0 ? null : value.trim();
};

export class UpdateLessonDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title?: string;

  @Transform(trimNullable)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'lessonDate must use YYYY-MM-DD' })
  lessonDate?: string;

  @Transform(trimNullable)
  @IsOptional()
  @IsUUID('4')
  subjectId?: string | null;

  @IsOptional()
  @IsEnum(LessonStatus)
  status?: LessonStatus;
}
