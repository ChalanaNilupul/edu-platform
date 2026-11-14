import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { FeeStatus } from '../../generated/prisma/client.js';
import { MONEY_PATTERN } from '../finance.shared.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const money = ({ value }: { value: unknown }) =>
  typeof value === 'number' ? value.toString() : trim({ value });

export class UpdateStudentFeeDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description?: string;

  @Transform(money)
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN, { message: 'amount must be a number with up to 2 decimals' })
  amount?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'dueDate must be a YYYY-MM-DD calendar date' })
  dueDate?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsEnum(FeeStatus)
  status?: FeeStatus;
}
