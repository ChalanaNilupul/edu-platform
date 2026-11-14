import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { PaymentMethod } from '../../generated/prisma/client.js';
import { MONEY_PATTERN } from '../finance.shared.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const money = ({ value }: { value: unknown }) =>
  typeof value === 'number' ? value.toString() : trim({ value });

export class CreatePaymentDto {
  @Transform(money)
  @IsString()
  @Matches(MONEY_PATTERN, { message: 'amount must be a number with up to 2 decimals' })
  amount!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsDateString({ strict: true }, { message: 'paidAt must be a YYYY-MM-DD calendar date' })
  paidAt!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
