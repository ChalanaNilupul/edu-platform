import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

import { DayOfWeek } from '../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateClassScheduleSlotDto {
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  membershipId?: string | null;

  @IsOptional()
  @IsEnum(DayOfWeek)
  dayOfWeek?: DayOfWeek;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  endMinutes?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  room?: string | null;
}
