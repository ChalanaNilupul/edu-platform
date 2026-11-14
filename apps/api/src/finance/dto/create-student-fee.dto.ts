import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { MONEY_PATTERN } from '../finance.shared.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const money = ({ value }: { value: unknown }) =>
  typeof value === 'number' ? value.toString() : trim({ value });

const nullableId = ({ value }: { value: unknown }) =>
  value === '' || value === null ? null : trim({ value });

export class CreateStudentFeeDto {
  @IsUUID()
  studentId!: string;

  @Transform(nullableId)
  @IsOptional()
  @IsUUID()
  classId?: string | null;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description!: string;

  @Transform(money)
  @IsString()
  @Matches(MONEY_PATTERN, { message: 'amount must be a number with up to 2 decimals' })
  amount!: string;

  @IsDateString({ strict: true }, { message: 'dueDate must be a YYYY-MM-DD calendar date' })
  dueDate!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
