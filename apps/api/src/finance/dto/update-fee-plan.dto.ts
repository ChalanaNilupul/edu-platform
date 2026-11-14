import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { BillingPeriod, FeePlanStatus } from '../../generated/prisma/client.js';
import { MONEY_PATTERN } from '../finance.shared.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const money = ({ value }: { value: unknown }) =>
  typeof value === 'number' ? value.toString() : trim({ value });

const nullableId = ({ value }: { value: unknown }) =>
  value === '' || value === null ? null : trim({ value });

const toNumber = ({ value }: { value: unknown }) => {
  if (value === undefined || value === '') {
    return undefined;
  }

  return Number(value);
};

export class UpdateFeePlanDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @Transform(money)
  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN, { message: 'amount must be a number with up to 2 decimals' })
  amount?: string;

  @Transform(nullableId)
  @IsOptional()
  @IsUUID()
  classId?: string | null;

  @IsOptional()
  @IsEnum(BillingPeriod)
  billingPeriod?: BillingPeriod;

  @Transform(toNumber)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  dueDay?: number;

  @IsOptional()
  @IsEnum(FeePlanStatus)
  status?: FeePlanStatus;
}
